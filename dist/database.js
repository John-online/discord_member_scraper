"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const node_fs_1 = tslib_1.__importDefault(require("node:fs"));
class Database {
    filePath;
    data;
    constructor(filePath) {
        this.filePath = filePath;
        if (!node_fs_1.default.existsSync(filePath)) {
            node_fs_1.default.writeFileSync(filePath, JSON.stringify({}));
        }
        this.data = JSON.parse(node_fs_1.default.readFileSync(filePath, "utf-8"));
    }
    get(key) {
        return this.data[key];
    }
    set(key, value) {
        this.data[key] = value;
        this.save();
    }
    delete(key) {
        delete this.data[key];
        this.save();
    }
    save() {
        node_fs_1.default.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    }
}
exports.default = Database;
