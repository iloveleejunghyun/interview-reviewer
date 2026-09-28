// Baseline native config shared by every app built from the factory.
// Encodes the TalkSum/PiggyNotebook release checklist so each new app
// starts compliant instead of relying on someone remembering it.
const { withInfoPlist, withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

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

// Must be listed FIRST in app.json "plugins": mods of the same type run in
// reverse order, so the first-listed plugin gets the last word on Info.plist
// and AndroidManifest (e.g. it strips the Face ID key expo-secure-store adds).
module.exports = function withAppBaseline(config, props = {}) {
  const iosUsageAllowlist = props.iosUsageAllowlist ?? DEFAULT_IOS_USAGE_ALLOWLIST;
  const androidBlocklist = props.androidBlocklist ?? DEFAULT_ANDROID_BLOCKLIST;
  config = withIosBaseline(config, { iosUsageAllowlist });
  config = withAndroidBaseline(config, { androidBlocklist });
  return config;
};
