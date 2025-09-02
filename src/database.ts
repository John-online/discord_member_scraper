import fs from "node:fs";

class Database {
  private filePath: string;
  private data: Record<string, any>;

  constructor(filePath: string) {
    this.filePath = filePath;

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({}));
    }

    this.data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  get(key: string): any {
    return this.data[key];
  }

  set(key: string, value: any): void {
    this.data[key] = value;
    this.save();
  }

  delete(key: string): void {
    delete this.data[key];
    this.save();
  }

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }
}

export default Database;
