const appleId = process.env.APPLE_ID;
const appleIdPassword = process.env.APPLE_APP_PASSWORD;
const teamId = process.env.APPLE_TEAM_ID;
const fs = require('fs');
const path = require('path');

module.exports = {
    "electronRebuildConfig": {
        "onlyModules": []
    },
    hooks: {
        packageAfterPrune: async (forgeConfig, buildPath, electronVersion, platform, arch) => {
            if (platform === 'darwin') {
                try {
                fs.unlinkSync(path.join(buildPath, 'node_modules/better-sqlite3/build/node_gyp_bins/python3'))
                } catch (e) {
                    console.log(e);
                }
                try {
                    fs.unlinkSync(path.join(buildPath, 'node_modules/lzma-native/build/node_gyp_bins/python3'))
                } catch (e) {
                    console.log(e);
                }
            }
        }
    },
    plugins: [
        {
            "name": "@electron-forge/plugin-auto-unpack-natives",
            "config": {}
        }
    ],
    "packagerConfig": {
        "plugins": [
            {
                "name": "@electron-forge/plugin-auto-unpack-natives",
                "config": {}
            }
        ],
        "osxSign": {
            "identity": "Developer ID Application: Erik Larson (2H2K93RATM)",
            "hardened-runtime": true,
            "entitlements": "entitlements.plist",
            "entitlements-inherit": "entitlements.plist",
            "signature-flags": "library"
        },
        osxNotarize: {
            appleId,
            appleIdPassword,
            teamId: teamId
        },
        "icon": "logo.icns",
        "asar": true,
        "arch": [
            "x64",
        ],
        "extraResource": [
            "./public"
        ]
    },
    "publish": [
        {
            "provider": "github",
            "releaseType": "draft"
        }
    ],
    "makers": [
        {
            "name": "@electron-forge/maker-squirrel",
            "config": {
                "name": "unbox",
                "platforms": [
                    "win32"
                ]
            }
        },
        {
            "name": "@electron-forge/maker-zip",
            "platforms": [
                "win32",
                "linux"
            ]
        },
        {
            "name": "@electron-forge/maker-deb",
            "config": {
                "options": {
                    "name": "unbox",
                    "productName": "Unbox"
                }
            }
        },
        {
            "name": "@electron-forge/maker-rpm",
            "config": {
                "options": {
                    "name": "unbox",
                    "productName": "Unbox"
                }
            }
        },
        {
            "name": "@electron-forge/maker-dmg",
            "config": {
                "name": "unbox",
                "arch": [
                    "universal",
                ],
                "platforms": [
                    "darwin"
                ]
            }
        }
    ]
}
