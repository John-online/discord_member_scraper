"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
