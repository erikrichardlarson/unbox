"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.denon = void 0;
const assert_1 = require("assert");
const sleep_1 = require("./utils/sleep");
const Controller_1 = require("./Controller");
const announce_1 = require("./announce");
const services_1 = require("./services");
const fs = require("fs");
const minimist = require("minimist");
require('console-stamp')(console, {
    format: ':date(HH:MM:ss) :label',
});
function makeDownloadPath(p_path) {
    const path = `./localdb/${p_path}`;
    let paths = path.split(/[/\\]/).filter((e) => e.length > 0);
    const isFolder = p_path.endsWith('/') || p_path.endsWith('\\');
    let filename = '';
    if (isFolder === false) {
        filename = paths[paths.length - 1];
        paths.pop();
    }
    const newPath = paths.join('/');
    fs.mkdirSync(newPath, { recursive: true });
    return newPath + ('/' + filename);
}
async function main() {
    const args = minimist(process.argv.slice(2));
    const controller = new Controller_1.Controller();
    await controller.connect();
    const sync = !args.skipsync;
    const ftx = await controller.connectToService(services_1.FileTransfer);
    assert_1.strict(ftx);
    const sources = await ftx.getSources();
    {
        for (const source of sources) {
            const dbPath = makeDownloadPath(source.database.location);
            // FIXME: Move all this away from main
            if (sync) {
                const file = await ftx.getFile(source.database.location);
                fs.writeFileSync(dbPath, file);
                console.info(`downloaded: '${source.database.location}' and stored in '${dbPath}'`);
            }
            await controller.addSource(source.name, dbPath, makeDownloadPath(`${source.name}/Album Art/`));
            if (sync) {
                await controller.dumpAlbumArt(source.name);
            }
        }
        ftx.disconnect();
    }
    await controller.connectToService(services_1.StateMap);
    // Endless loop
    while (true) {
        await sleep_1.sleep(250);
    }
}
async function denon() {
    let returnCode = 0;
    try {
        process.on('SIGINT', async function () {
            console.info('... exiting');
            // Ensure SIGINT won't be impeded by some error
            try {
                await announce_1.unannounce();
            }
            catch (err) {
                const message = err.stack.toString();
                console.error(message);
            }
            process.exit(returnCode);
        });
        await announce_1.announce();
        await main();
    }
    catch (err) {
        const message = err.stack.toString();
        console.error(message);
        returnCode = 1;
    }
    await announce_1.unannounce();
    process.exit(returnCode);
}
exports.denon = denon;
;
//# sourceMappingURL=main.js.map