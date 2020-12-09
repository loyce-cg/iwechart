module.exports = {
      packagerConfig: {
        extendInfo: "./files-extensions.plist",
        appBundleId: "com.privmx.app",
        dir: "./app",
        asar: {
          unpackDir: "**{/node_modules/screenshot-desktop,/node_modules/spellchecker,/dist/dictionaries,/node_modules/trash}/**/*",
          unpack: "**/*.node"
        },
        executableName: "PrivMX",
        icon: "dist/icons/app-icon.icns",
        overwrite: true,

        hardenedRuntime : false,
        gatekeeperAssess: false,

      },
      makers: [
      ]      
}