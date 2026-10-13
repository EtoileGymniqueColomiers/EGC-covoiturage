const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# Force minimum iOS deployment target';

/**
 * Ensures every CocoaPods target uses at least the given iOS deployment target.
 * Needed because some pods (e.g. react-native-maps privacy bundle) still ship with 11.0.
 */
function withIosDeploymentTarget(config, { deploymentTarget = '15.1' } = {}) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes(MARKER)) {
        return cfg;
      }

      const snippet = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'
      end
    end`;

      if (!contents.includes('post_install do |installer|')) {
        throw new Error('Could not find post_install in Podfile');
      }

      contents = contents.replace(
        /react_native_post_install\(\s*installer,\s*config\[:reactNativePath\],[\s\S]*?\)/,
        (match) => `${match}\n${snippet}`
      );

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
}

module.exports = withIosDeploymentTarget;
