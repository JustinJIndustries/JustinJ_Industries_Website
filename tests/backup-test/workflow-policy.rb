require 'yaml'

# The hosted rehearsal has no secrets. Also inspect the actual dispatch workflow
# so success in the rehearsal cannot hide a change to the publisher's job graph.
workflow = YAML.safe_load(File.read('.github/workflows/backup-only-test.yml'))
jobs = workflow.fetch('jobs')
admission = jobs.fetch('admit')
build = jobs.fetch('build')
preview = jobs.fetch('preview')

def check(description, condition)
  abort "FAIL #{description}" unless condition
  puts "PASS #{description}"
end

def checkout_paths(job)
  job.fetch('steps').select { |step| step.fetch('uses', '').start_with?('actions/checkout@') }
     .map { |step| step.fetch('with').values_at('path', 'ref', 'persist-credentials') }
end

check('manual dispatch and default-deny permissions',
      (workflow['on'] || workflow[true]).keys == ['workflow_dispatch'] && workflow['permissions'] == {})
check('admission, build and preview each use a separate hosted job',
      jobs.keys.sort == %w[admit build preview] && jobs.values.all? { |job| job['runs-on'] == 'ubuntu-latest' } &&
      build['needs'] == 'admit' && preview['needs'] == %w[admit build])

owner_gates = ["github.ref == 'refs/heads/release-control'", 'github.sha == vars.JJI_BACKUP_CONTROL_SHA',
               'github.sha == inputs.approved_workflow_sha', "github.actor == 'JustinJIndustries'",
               "github.triggering_actor == 'JustinJIndustries'", 'github.run_attempt == 1']
check('every job requires the owner and an independently enrolled SHA',
      jobs.values.all? { |job| owner_gates.all? { |gate| job.fetch('if').include?(gate) } })

readonly = { 'contents' => 'read', 'actions' => 'read' }
control = [['control', '${{ github.sha }}', false]]
check('admission is read-only and has no environment or secret',
      admission['permissions'] == readonly && !admission.key?('environment') &&
      !admission.to_s.include?('secrets.') && checkout_paths(admission) == control)
check('the build sees only read-only source, with no environment or cached deployment tooling',
      build['permissions'] == { 'contents' => 'read' } && !build.key?('environment') &&
      !build.to_s.match?(/secrets\.|CLOUDFLARE|actions\/cache|upload-artifact/) &&
      checkout_paths(build) == control + [['production', 'd6574ede41a8620f838b6eafd3e7ba76ea7ebf68', false]])
check('preview requests only the environment admitted by the unprivileged job',
      admission.fetch('steps').last['run'] == 'node control/infrastructure/backup-test/verify-run.mjs admit' &&
      preview['environment'] == '${{ needs.admit.outputs.environment }}' &&
      preview.fetch('if').include?("needs.admit.outputs.environment == 'backup-preview'") &&
      preview.fetch('env')['BACKUP_ENVIRONMENT_ID'] == '${{ needs.admit.outputs.environment_id }}')
check('the publisher checks out only the enrolled control',
      preview['permissions'] == readonly && checkout_paths(preview) == control)

steps = preview.fetch('steps')
verify = steps.each_index.select { |i| steps[i]['run'] == 'node control/infrastructure/backup-test/verify-run.mjs' }
restore = steps.index { |step| step.dig('env', 'BUILD_MANIFEST') == '${{ needs.build.outputs.manifest }}' }
secret = steps.each_index.select { |i| steps[i].to_s.include?('secrets.') }
check('only the designated preview upload receives the token after the second admission check',
      verify.size == 2 && secret.size == 1 && restore && verify.first < restore && restore < verify.last &&
      secret.first == verify.last + 1 && steps[secret.first].fetch('run').include?('backup-only.mjs deploy'))
