import Foundation
import AVFoundation
import CoreGraphics
import CoreText
import ImageIO
import Vision

// Usage: executable original.mp4 corrected.mp4 poster.png verification-directory
// Source and output must differ. Verification records are never deployment assets.
struct Frame { let time: CMTime; let width: Int; let height: Int; let bytes: [UInt8] }
let args = CommandLine.arguments
if args.count != 5 { fatalError("Expected original.mp4 corrected.mp4 poster.png verification-directory") }
let input = URL(fileURLWithPath: args[1]), output = URL(fileURLWithPath: args[2]), poster = URL(fileURLWithPath: args[3]), evidence = URL(fileURLWithPath: args[4], isDirectory: true)
guard input.standardizedFileURL != output.standardizedFileURL else { fatalError("Keep source media immutable") }
let fm = FileManager.default
try fm.createDirectory(at: evidence, withIntermediateDirectories: true)
let width = 960, height = 540
// Original caption occupies x40...376, top-origin y494...508. This clipped patch
// covers only that caption on the uniform background, below all animated art.
let patch = (left: 34, top: 486, right: 405, bottom: 516)
let caption = "Original silent motion study / Design study"
let bitmapInfo = CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
let space = CGColorSpaceCreateDeviceRGB()
func decode(_ url: URL) throws -> (AVURLAsset, [Frame]) {
  let asset = AVURLAsset(url: url)
  guard let track = asset.tracks(withMediaType: .video).first else { fatalError("No video track") }
  let reader = try AVAssetReader(asset: asset)
  let trackOutput = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
  trackOutput.alwaysCopiesSampleData = false
  reader.add(trackOutput)
  guard reader.startReading() else { throw reader.error! }
  var frames = [Frame]()
  while let sample = trackOutput.copyNextSampleBuffer() {
    guard let buffer = CMSampleBufferGetImageBuffer(sample) else { fatalError("No image buffer") }
    CVPixelBufferLockBaseAddress(buffer, .readOnly)
    let w = CVPixelBufferGetWidth(buffer), h = CVPixelBufferGetHeight(buffer), row = CVPixelBufferGetBytesPerRow(buffer)
    let ptr = CVPixelBufferGetBaseAddress(buffer)!.assumingMemoryBound(to: UInt8.self)
    var bytes = [UInt8](repeating: 0, count: w*h*4)
    bytes.withUnsafeMutableBytes { dest in
      for y in 0..<h { memcpy(dest.baseAddress! + y*w*4, ptr + y*row, w*4) }
    }
    CVPixelBufferUnlockBaseAddress(buffer, .readOnly)
    frames.append(Frame(time: CMSampleBufferGetPresentationTimeStamp(sample), width: w, height: h, bytes: bytes))
  }
  guard reader.status == .completed else { throw reader.error! }
  return (asset, frames)
}
func image(_ f: Frame) -> CGImage {
  let provider = CGDataProvider(data: Data(f.bytes) as CFData)!
  return CGImage(width:f.width,height:f.height,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:f.width*4,space:space,bitmapInfo:CGBitmapInfo(rawValue:bitmapInfo),provider:provider,decode:nil,shouldInterpolate:false,intent:.defaultIntent)!
}
func png(_ im: CGImage, _ url: URL) {
  let dst = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil)!
  CGImageDestinationAddImage(dst, im, nil)
  guard CGImageDestinationFinalize(dst) else { fatalError("PNG write failed") }
}
func sheet(_ frames: [Frame], _ name: String) {
  let tw = 192, th = 108, columns = 10, rows = (frames.count+columns-1)/columns
  let c = CGContext(data:nil,width:tw*columns,height:th*rows,bitsPerComponent:8,bytesPerRow:tw*columns*4,space:space,bitmapInfo:bitmapInfo)!
  c.interpolationQuality = .high
  for (i,f) in frames.enumerated() { c.draw(image(f), in: CGRect(x:(i%columns)*tw,y:(rows-1-i/columns)*th,width:tw,height:th)) }
  png(c.makeImage()!, evidence.appendingPathComponent(name))
}
func recognize(_ im: CGImage) throws -> [[String:Any]] {
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["en-US"]
  req.usesLanguageCorrection = false
  req.minimumTextHeight = 0.003
  try VNImageRequestHandler(cgImage:im,options:[:]).perform([req])
  return (req.results ?? []).compactMap { o in
    guard let t=o.topCandidates(1).first else { return nil }
    return ["text":t.string,"confidence":t.confidence,"box":[o.boundingBox.origin.x,o.boundingBox.origin.y,o.boundingBox.width,o.boundingBox.height]]
  }
}
let (originalAsset, originals) = try decode(input)
guard originals.count == 60, originals.allSatisfy({$0.width == width && $0.height == height}), abs(CMTimeGetSeconds(originalAsset.duration)-4)<0.001 else { fatalError("Unexpected source geometry/duration/count") }
guard originalAsset.tracks(withMediaType:.audio).isEmpty else { fatalError("Expected original without audio") }
var bandEvidence = [[String:Any]]()
var correctedFrames = [Frame]()
let font = CTFontCreateWithName("Helvetica" as CFString,14,nil)
let line = CTLineCreateWithAttributedString(NSAttributedString(string:caption,attributes:[NSAttributedString.Key(kCTFontAttributeName as String):font,NSAttributedString.Key(kCTForegroundColorAttributeName as String):CGColor(gray:0,alpha:1)]))
for (i, f) in originals.enumerated() {
  let background = Array(f.bytes[((500*width+10)*4)..<((500*width+10)*4+4)])
  var minRGB=[255,255,255], maxRGB=[0,0,0]
  // Confirm that all four edges and a row below the text have uniform background.
  for y in [482,486,515,520] { for x in stride(from:10,to:440,by:5) {
    let j=(y*width+x)*4
    for channel in 0..<3 { minRGB[channel]=min(minRGB[channel],Int(f.bytes[j+channel]));maxRGB[channel]=max(maxRGB[channel],Int(f.bytes[j+channel])) }
  } }
  guard zip(minRGB,maxRGB).allSatisfy({$1-$0 <= 10}) else { fatalError("Nonuniform caption surroundings in frame \(i)") }
  var b = f.bytes
  for y in patch.top..<patch.bottom { for x in patch.left..<patch.right {
    let j=(y*width+x)*4
    for channel in 0..<4 { b[j+channel]=background[channel] }
  } }
  b.withUnsafeMutableBytes { ptr in
    let c=CGContext(data:ptr.baseAddress!,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:space,bitmapInfo:bitmapInfo)!
    c.clip(to:CGRect(x:patch.left,y:height-patch.bottom,width:patch.right-patch.left,height:patch.bottom-patch.top))
    c.textPosition=CGPoint(x:40,y:35)
    CTLineDraw(line,c)
  }
  var outsideChanged=0
  for y in 0..<height { for x in 0..<width {
    if y>=patch.top && y<patch.bottom && x>=patch.left && x<patch.right { continue }
    let j=(y*width+x)*4
    if f.bytes[j] != b[j] || f.bytes[j+1] != b[j+1] || f.bytes[j+2] != b[j+2] || f.bytes[j+3] != b[j+3] { outsideChanged += 1 }
  } }
  guard outsideChanged == 0 else { fatalError("Pixels outside caption patch changed") }
  bandEvidence.append(["frame":i,"seconds":CMTimeGetSeconds(f.time),"sampled_background_BGRA":background,"surrounding_min_BGR":minRGB,"surrounding_max_BGR":maxRGB,"outside_patch_changed_pixels_before_encode":outsideChanged])
  correctedFrames.append(Frame(time:f.time,width:width,height:height,bytes:b))
}
sheet(originals,"original-all-60-frames.png")
if fm.fileExists(atPath:output.path) { try fm.removeItem(at:output) }
let writer = try AVAssetWriter(outputURL:output,fileType:.mp4)
let settings:[String:Any]=[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:width,AVVideoHeightKey:height,AVVideoCompressionPropertiesKey:[AVVideoAverageBitRateKey:8_000_000,AVVideoExpectedSourceFrameRateKey:15,AVVideoMaxKeyFrameIntervalKey:15,AVVideoAllowFrameReorderingKey:false,AVVideoProfileLevelKey:AVVideoProfileLevelH264HighAutoLevel]]
let videoInput=AVAssetWriterInput(mediaType:.video,outputSettings:settings)
videoInput.expectsMediaDataInRealTime=false
let adaptor=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:videoInput,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA,kCVPixelBufferWidthKey as String:width,kCVPixelBufferHeightKey as String:height])
writer.add(videoInput)
guard writer.startWriting() else { throw writer.error! }
writer.startSession(atSourceTime:.zero)
for f in correctedFrames {
  while !videoInput.isReadyForMoreMediaData { if writer.status == .failed { throw writer.error! }; Thread.sleep(forTimeInterval:0.001) }
  var pb:CVPixelBuffer?
  guard CVPixelBufferPoolCreatePixelBuffer(nil,adaptor.pixelBufferPool!,&pb)==kCVReturnSuccess else { fatalError("Buffer allocation failed") }
  let buffer=pb!;CVPixelBufferLockBaseAddress(buffer,[])
  let dst=CVPixelBufferGetBaseAddress(buffer)!,row=CVPixelBufferGetBytesPerRow(buffer)
  f.bytes.withUnsafeBytes { ptr in for y in 0..<height { memcpy(dst+y*row,ptr.baseAddress!+y*width*4,width*4) } }
  CVPixelBufferUnlockBaseAddress(buffer,[])
  guard adaptor.append(buffer,withPresentationTime:f.time) else { throw writer.error! }
}
videoInput.markAsFinished();writer.endSession(atSourceTime:CMTime(value:4,timescale:1))
let semaphore=DispatchSemaphore(value:0)
writer.finishWriting { semaphore.signal() }
guard semaphore.wait(timeout: .now() + 60) == .success,writer.status == .completed else { fatalError("Encode failed: \(String(describing:writer.error))") }
let (correctedAsset, encoded) = try decode(output)
guard encoded.count == 60,encoded.allSatisfy({$0.width==width && $0.height==height}),correctedAsset.tracks(withMediaType:.audio).isEmpty,abs(CMTimeGetSeconds(correctedAsset.duration)-4)<0.001 else { fatalError("Encoded media contract changed") }
guard zip(originals,encoded).allSatisfy({CMTimeCompare($0.time,$1.time)==0}) else { fatalError("Frame timestamps changed") }
let track=correctedAsset.tracks(withMediaType:.video).first!
guard abs(track.nominalFrameRate-15)<0.001 else { fatalError("Frame rate changed") }
// Poster is the actual first frame decoded from the corrected delivery MP4.
png(image(encoded[0]),poster)
sheet(encoded,"corrected-all-60-frames.png")
var verification = [[String:Any]]()
for (i,f) in encoded.enumerated() {
  var total:Int64=0;var maximum=0;var channels:Int64=0
  for y in 0..<height { for x in 0..<width {
    // Include an eight-pixel codec-block margin in the post-encode comparison.
    if y>=patch.top-8 && y<patch.bottom+8 && x>=patch.left-8 && x<patch.right+8 { continue }
    let j=(y*width+x)*4
    for c in 0..<3 { let delta=abs(Int(f.bytes[j+c])-Int(originals[i].bytes[j+c]));total+=Int64(delta);maximum=max(maximum,delta);channels+=1 }
  } }
  let lines=try recognize(image(f))
  let strings=lines.compactMap{$0["text"] as? String}
  guard strings.contains(caption), !strings.contains(where:{$0.lowercased().contains("self-initiated")}) else { fatalError("Frame \(i) caption OCR mismatch: \(strings)") }
  guard strings.contains("ARC / OPEN PROGRAMME"),strings.contains("ARC"),strings.contains("One curve. Several voices.") else { fatalError("Frame \(i) non-caption text changed") }
  verification.append(["frame":i,"seconds":CMTimeGetSeconds(f.time),"ocr_lines":lines,"outside_caption_codec_margin_mean_absolute_BGR_error":Double(total)/Double(channels),"outside_caption_codec_margin_max_channel_error":maximum])
  print("Verified frame \(i+1)/60");fflush(stdout)
}
let report:[String:Any]=["source":input.path,"output":output.path,"poster":poster.path,"caption":caption,"source_frames":originals.count,"output_frames":encoded.count,"width":width,"height":height,"duration_seconds":CMTimeGetSeconds(correctedAsset.duration),"nominal_frame_rate":track.nominalFrameRate,"audio_tracks":correctedAsset.tracks(withMediaType:.audio).count,"all_frame_timestamps_preserved":true,"patch_top_origin":[patch.left,patch.top,patch.right,patch.bottom],"outside_patch_preencode_pixels_preserved_all_frames":true,"uniform_background_checks":bandEvidence,"all_frame_ocr_and_encode_error":verification,"poster_origin":"First frame decoded from corrected encoded MP4; no independent recreation","contact_sheets":"All original and all corrected decoded frames, chronological left-to-right then top-to-bottom."]
let data=try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]);try data.write(to:evidence.appendingPathComponent("arc-native-verification.json"))
print("Complete: 60 original frames, 60 corrected frames, all captions verified, original motion timestamps preserved.")
