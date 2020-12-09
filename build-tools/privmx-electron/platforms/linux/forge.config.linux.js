module.exports = {
      packagerConfig: {
        dir: "./app",
        asar: {
          unpackDir: "**{/node_modules/screenshot-desktop,/node_modules/spellchecker,/dist/dictionaries}/**/*"
        },
        executableName: "PrivMX",
        icon: "platforms/LINUX/icons/app-icon.png",
        overwrite: true,
        afterExtract: [
            "./build-scripts/after-extract.js"
        ]
        
      },
      makers: [
      ]
}