// Read-only Safari/Accessibility bridge, fixed to the single approved Worker.
// No clipboard, cookies, JavaScript injection, credential reads or provider writes.
import AppKit
import ApplicationServices
import Foundation
let base="https://dash.cloudflare.com/api/v4/accounts/986b5334eba2d05d253ee98ca9842dfe/workers/scripts/jji-failover"
let owned="https://dash.cloudflare.com/986b5334eba2d05d253ee98ca9842dfe/workers/services/"
let args=CommandLine.arguments
func uuid(_ s:String)->Bool {s.range(of:"^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$",options:.regularExpression) != nil}
guard args.count==3,uuid(args[2]) else {fatalError("Checkpoint nonce required")}
let suffix:String
if ["deployments","settings"].contains(args[1]) {suffix=args[1]}
else {let parts=args[1].split(separator:":");guard parts.count==2,parts[0]=="version",uuid(String(parts[1])) else {fatalError("Unsupported read-only Worker target")};suffix="versions/"+parts[1]}
let target=base+"/"+suffix+"?jji_checkpoint="+args[2]+"-"+String(Date().timeIntervalSince1970)
let script="""
tell application "Safari"
 repeat with w in windows
  repeat with t in tabs of w
   if (URL of t starts with "\(base)") or (URL of t starts with "\(owned)view/jji-failover/production") or (URL of t starts with "\(owned)edit/jji-failover/production") then
    set URL of t to "\(target)"
    set current tab of w to t
    return "opened exact read-only Worker target"
   end if
  end repeat
 end repeat
 error "Existing authorized Worker tab absent"
end tell
"""
var error:NSDictionary?
guard let apple=NSAppleScript(source:script) else {fatalError("Cannot construct read-only navigation")};apple.executeAndReturnError(&error)
guard error==nil,let app=NSRunningApplication.runningApplications(withBundleIdentifier:"com.apple.Safari").first else {fatalError("Existing Safari session unavailable")}
let ax=AXUIElementCreateApplication(app.processIdentifier);AXUIElementSetMessagingTimeout(ax,1)
func get(_ e:AXUIElement,_ k:String)->CFTypeRef? {var v:CFTypeRef?;return AXUIElementCopyAttributeValue(e,k as CFString,&v) == .success ? v:nil}
func area(_ e:AXUIElement,_ d:Int=0)->AXUIElement? {
 if d>65{return nil};if get(e,kAXRoleAttribute) as? String=="AXWebArea",let u=get(e,kAXURLAttribute),String(describing:u)==target{return e}
 for c in (get(e,kAXChildrenAttribute) as? [AXUIElement]) ?? [] {if let a=area(c,d+1){return a}};return nil
}
func texts(_ e:AXUIElement,_ d:Int=0)->[String] {
 if d>65{return []};var output:[String]=[]
 if ["AXStaticText","AXTextArea"].contains(get(e,kAXRoleAttribute) as? String ?? ""),let v=get(e,kAXValueAttribute) as? String {output.append(v)}
 for c in (get(e,kAXChildrenAttribute) as? [AXUIElement]) ?? [] {output += texts(c,d+1)};return output
}
for _ in 0..<120 {
 if let w=area(ax),let data=texts(w).joined(separator:"\n").data(using:.utf8),let value=try? JSONSerialization.jsonObject(with:data) {FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject:value,options:[.sortedKeys]));exit(0)}
 usleep(100000)
}
fatalError("Read-only Worker metadata did not render; no alternate access")
