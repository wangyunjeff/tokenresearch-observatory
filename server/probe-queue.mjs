// One queue covers all groups and probe types, including the pelican executor.
export class ProbeQueue {
  constructor() {
    this.tail = Promise.resolve();
    this.active = null;
    this.pending = [];
  }

  run(label, task) {
    const ticket = {label};
    this.pending.push(ticket);
    const result = this.tail.then(async () => {
      this.pending.splice(this.pending.indexOf(ticket), 1);
      this.active = label;
      try { return await task(); }
      finally { this.active = null; }
    });
    this.tail = result.catch(() => {});
    return result;
  }

  summary() {
    return {concurrency:1, active:this.active, pending:this.pending.map(x => x.label)};
  }
}
