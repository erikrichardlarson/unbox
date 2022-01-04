"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = void 0;
function sleep(p_ms) {
    return new Promise((resolve) => setTimeout(resolve, p_ms));
}
exports.sleep = sleep;
//# sourceMappingURL=sleep.js.map