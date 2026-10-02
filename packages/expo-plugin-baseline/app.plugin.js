// Baseline native config shared by every app built from the factory.
// Encodes the TalkSum/PiggyNotebook release checklist so each new app
// starts compliant instead of relying on someone remembering it.
const { withInfoPlist, withAndroidManifest, withAppDelegate, AndroidConfig } = require('expo/config-plugins');

// iOS: usage-description keys an app may keep. Anything else ending in
// "UsageDescription" that a dependency injects is stripped.
const DEFAULT_IOS_USAGE_ALLOWLIST = ['NSMicrophoneUsageDescription'];

// Android: permissions that must never reach the merged manifest, even if a
// library declares them transitively.
const DEFAULT_ANDROID_BLOCKLIST = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.VIBRATE',
  'com.google.android.gms.permission.AD_ID',
];

// Android: permissions every app gets. Keep in sync with the checklist.
const REQUIRED_ANDROID_PERMISSIONS = ['android.permission.ACCESS_NETWORK_STATE'];

function withIosBaseline(config, { iosUsageAllowlist }) {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    for (const key of Object.keys(plist)) {
      if (key.endsWith('UsageDescription') && !iosUsageAllowlist.includes(key)) {
        delete plist[key];
      }
    }
    plist.ITSAppUsesNonExemptEncryption = false;
    return cfg;
  });
}

function withAndroidBaseline(config, { androidBlocklist }) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    // Drop any direct declarations first...
    manifest.manifest['uses-permission'] = (manifest.manifest['uses-permission'] ?? []).filter(
      (p) => !androidBlocklist.includes(p.$['android:name'])
    );
    for (const name of REQUIRED_ANDROID_PERMISSIONS) {
      AndroidConfig.Permissions.addPermission(manifest, name);
    }
    // ...then add tools:node="remove" so library manifests can't merge them back in.
    AndroidConfig.Manifest.ensureToolsAvailable(manifest);
    for (const name of androidBlocklist) {
      manifest.manifest['uses-permission'].push({
        $: { 'android:name': name, 'tools:node': 'remove' },
      });
    }
    return cfg;
  });
}

// iOS 27 traps at launch (EXC_BREAKPOINT in
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption) unless the app
// adopts the UIScene life cycle. Expo SDK 57's template doesn't (SDK 58 does),
// but expo@57 ships ExpoAppSceneDelegate, so wire it up:
//   1. Info.plist scene manifest naming EXExpoAppSceneDelegate
//   2. AppDelegate conforms to ExpoReactNativeFactoryProvider
//   3. AppDelegate stops creating the window; the scene delegate does it
// Remove once on SDK 58+.
function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate');
    }
    let src = cfg.modResults.contents;
    const decl = 'class AppDelegate: ExpoAppDelegate {';
    if (src.includes(decl)) {
      src = src.replace(decl, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    }
    const windowBlock = /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?#endif\n?/;
    src = src.replace(windowBlock, '// Window + React Native start are done by ExpoAppSceneDelegate (scene life cycle).\n');
    // Fail loudly if the template changed and the patch no longer applies.
    if (!src.includes('ExpoReactNativeFactoryProvider') || src.includes('UIWindow(frame:')) {
      throw new Error('withSceneLifecycle: AppDelegate template changed; update the patch');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

// Must be listed FIRST in app.json "plugins": mods of the same type run in
// reverse order, so the first-listed plugin gets the last word on Info.plist
// and AndroidManifest (e.g. it strips the Face ID key expo-secure-store adds).
module.exports = function withAppBaseline(config, props = {}) {
  const iosUsageAllowlist = props.iosUsageAllowlist ?? DEFAULT_IOS_USAGE_ALLOWLIST;
  const androidBlocklist = props.androidBlocklist ?? DEFAULT_ANDROID_BLOCKLIST;
  config = withIosBaseline(config, { iosUsageAllowlist });
  config = withAndroidBaseline(config, { androidBlocklist });
  config = withSceneLifecycle(config);
  return config;
};
