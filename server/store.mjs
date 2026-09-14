import fs from 'node:fs/promises';
import path from 'node:path';

export class JsonStore {
  constructor(file, limits = {}) {
    this.file = file;
    this.limits = {candy: limits.candy ?? 1000, pelicans: limits.pelicans ?? 100};
    this.state = {schema_version:1, candy:[], pelicans:[], health:{}};
    this.writeChain = Promise.resolve();
  }

  async load() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (parsed?.schema_version === 1) this.state = {...this.state, ...parsed};
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    this.trim();
    return this.state;
  }

  trim() {
    this.state.candy = (this.state.candy || []).slice(-this.limits.candy);
    this.state.pelicans = (this.state.pelicans || []).slice(-this.limits.pelicans);
  }

  async save() {
    this.trim();
    const payload = JSON.stringify(this.state, null, 2) + '\n';
    this.writeChain = this.writeChain.then(async () => {
      await fs.mkdir(path.dirname(this.file), {recursive:true});
      const temp = `${this.file}.tmp`;
      await fs.writeFile(temp, payload, {mode:0o600});
      await fs.rename(temp, this.file);
    });
    return this.writeChain;
  }
}
