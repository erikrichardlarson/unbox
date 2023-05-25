const appleId = process.env.APPLE_ID;
const appleIdPassword = process.env.APPLE_APP_PASSWORD;

module.exports = {
    "electronRebuildConfig": {
        "onlyModules": []
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
        },
        "icon": "logo.icns",
        "asar": true,
        "arch": [
            "x64",
            "arm64"
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
                "platforms": [
                    "darwin"
                ]
            }
        }
    ]
}
