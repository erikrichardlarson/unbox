"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMap = exports.States = void 0;
const assert_1 = require("assert");
const common_1 = require("../common");
const WriteContext_1 = require("../utils/WriteContext");
const Service_1 = require("./Service");
const fs = require("fs");
exports.States = [
    // Mixer
    common_1.StageLinqValue.MixerCH1faderPosition,
    common_1.StageLinqValue.MixerCH2faderPosition,
    common_1.StageLinqValue.MixerCrossfaderPosition,
    // Decks
    common_1.StageLinqValue.EngineDeck1Play,
    common_1.StageLinqValue.EngineDeck1PlayState,
    common_1.StageLinqValue.EngineDeck1PlayStatePath,
    common_1.StageLinqValue.EngineDeck1TrackArtistName,
    common_1.StageLinqValue.EngineDeck1TrackTrackNetworkPath,
    common_1.StageLinqValue.EngineDeck1TrackSongLoaded,
    common_1.StageLinqValue.EngineDeck1TrackSongName,
    common_1.StageLinqValue.EngineDeck1TrackTrackData,
    common_1.StageLinqValue.EngineDeck1TrackTrackName,
    common_1.StageLinqValue.EngineDeck1CurrentBPM,
    common_1.StageLinqValue.EngineDeck1ExternalMixerVolume,
    common_1.StageLinqValue.EngineDeck2Play,
    common_1.StageLinqValue.EngineDeck2PlayState,
    common_1.StageLinqValue.EngineDeck2PlayStatePath,
    common_1.StageLinqValue.EngineDeck2TrackArtistName,
    common_1.StageLinqValue.EngineDeck2TrackTrackNetworkPath,
    common_1.StageLinqValue.EngineDeck2TrackSongLoaded,
    common_1.StageLinqValue.EngineDeck2TrackSongName,
    common_1.StageLinqValue.EngineDeck2TrackTrackData,
    common_1.StageLinqValue.EngineDeck2TrackTrackName,
    common_1.StageLinqValue.EngineDeck2CurrentBPM,
    common_1.StageLinqValue.EngineDeck2ExternalMixerVolume,
    common_1.StageLinqValue.EngineDeck3Play,
    common_1.StageLinqValue.EngineDeck3PlayState,
    common_1.StageLinqValue.EngineDeck3PlayStatePath,
    common_1.StageLinqValue.EngineDeck3TrackArtistName,
    common_1.StageLinqValue.EngineDeck3TrackTrackNetworkPath,
    common_1.StageLinqValue.EngineDeck3TrackSongLoaded,
    common_1.StageLinqValue.EngineDeck3TrackSongName,
    common_1.StageLinqValue.EngineDeck3TrackTrackData,
    common_1.StageLinqValue.EngineDeck3TrackTrackName,
    common_1.StageLinqValue.EngineDeck3CurrentBPM,
    common_1.StageLinqValue.EngineDeck3ExternalMixerVolume,
    common_1.StageLinqValue.EngineDeck4Play,
    common_1.StageLinqValue.EngineDeck4PlayState,
    common_1.StageLinqValue.EngineDeck4PlayStatePath,
    common_1.StageLinqValue.EngineDeck4TrackArtistName,
    common_1.StageLinqValue.EngineDeck4TrackTrackNetworkPath,
    common_1.StageLinqValue.EngineDeck4TrackSongLoaded,
    common_1.StageLinqValue.EngineDeck4TrackSongName,
    common_1.StageLinqValue.EngineDeck4TrackTrackData,
    common_1.StageLinqValue.EngineDeck4TrackTrackName,
    common_1.StageLinqValue.EngineDeck4CurrentBPM,
    common_1.StageLinqValue.EngineDeck4ExternalMixerVolume,
];
const MAGIC_MARKER = 'smaa';
// FIXME: Is this thing really an interval?
const MAGIC_MARKER_INTERVAL = 0x000007d2;
const MAGIC_MARKER_JSON = 0x00000000;
class StateMap extends Service_1.Service {
    async init() {
        for (const state of exports.States) {
            await this.subscribeState(state, 0);
        }
    }
    parseData(p_ctx) {
        const marker = p_ctx.getString(4);
        assert_1.strict(marker === MAGIC_MARKER);
        const type = p_ctx.readUInt32();
        switch (type) {
            case MAGIC_MARKER_JSON: {
                const name = p_ctx.readNetworkStringUTF16();
                const json = JSON.parse(p_ctx.readNetworkStringUTF16());
                return {
                    id: MAGIC_MARKER_JSON,
                    message: {
                        name: name,
                        json: json,
                    },
                };
            }
            case MAGIC_MARKER_INTERVAL: {
                const name = p_ctx.readNetworkStringUTF16();
                const interval = p_ctx.readInt32();
                return {
                    id: MAGIC_MARKER_INTERVAL,
                    message: {
                        name: name,
                        interval: interval,
                    },
                };
            }
            default:
                break;
        }
        assert_1.strict.fail(`Unhandled type ${type}`);
        return null;
    }
    messageHandler(p_data) {
        
        let stagelinqEvent = p_data.message.name;
        let stagelinqEventValue = p_data.message.json ? JSON.stringify(p_data.message.json) : p_data.message.interval;

        if ((stagelinqEvent.includes('PlayState')) || (stagelinqEvent.includes('ExternalMixerVolume')) || (stagelinqEvent.includes('ArtistName')) || (stagelinqEvent.includes('SongName'))) {

            let [stagelinqEventType, deck, ..._rest] = stagelinqEvent.split('/').reverse();
            let deckState = JSON.parse(fs.readFileSync('./deckState.json', 'utf8'));

            deckState[deck] = { ...{}, ...deckState[deck] };
            deckState[deck][stagelinqEventType] = stagelinqEventType.includes('PlayState') ? stagelinqEventValue['state'] : stagelinqEventValue['value'] || stagelinqEventValue['string'];

            fs.writeFileSync('./deckState.json', JSON.stringify(deckState));
        }

        console.log(`${p_data.message.name} => ${p_data.message.json ? JSON.stringify(p_data.message.json) : p_data.message.interval}`);
        if (p_data.message.name.includes('TrackNetworkPath')) {
            const path = this.controller.getAlbumArtPath(p_data.message.json.string);
            // Now pretend as if this is a value outputted by the device
            if (path) {
                console.log(`${p_data.message.name.replace('TrackNetworkPath', 'TrackLocalAlbumArtPath')} => {"string": "${path}", "type":0}`);
            }
            else {
                console.log(`${p_data.message.name.replace('TrackNetworkPath', 'TrackLocalAlbumArtPath')} => {"string": null, "type":-1}`);
            }
        }
    }
    async subscribeState(p_state, p_interval) {
        //console.log(`Subscribe to state '${p_state}'`);
        const getMessage = function () {
            const ctx = new WriteContext_1.WriteContext();
            ctx.writeFixedSizedString(MAGIC_MARKER);
            ctx.writeUInt32(MAGIC_MARKER_INTERVAL);
            ctx.writeNetworkStringUTF16(p_state);
            ctx.writeUInt32(p_interval);
            return ctx.getBuffer();
        };
        const message = getMessage();
        {
            const ctx = new WriteContext_1.WriteContext();
            ctx.writeUInt32(message.length);
            const written = await this.connection.write(ctx.getBuffer());
            assert_1.strict(written === 4);
        }
        {
            const written = await this.connection.write(message);
            assert_1.strict(written === message.length);
        }
    }
}
exports.StateMap = StateMap;
//# sourceMappingURL=StateMap.js.map