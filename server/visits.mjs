import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';

export class VisitCounter {
  constructor(file){this.file=file;this.chain=Promise.resolve();}
  async load(){
    try{this.state=JSON.parse(await fs.readFile(this.file,'utf8'));}
    catch(error){if(error.code!=='ENOENT')throw error;this.state={baseline:1000,views:0,visitors:0,secret:randomBytes(32).toString('hex')};await this.save(this.state);}
  }
  async save(state){await fs.mkdir(path.dirname(this.file),{recursive:true});await fs.writeFile(this.file+'.tmp',JSON.stringify(state),{mode:0o600});await fs.rename(this.file+'.tmp',this.file);}
  summary(){const {baseline,views,visitors}=this.state;return {baseline,views,visitors,total_views:baseline+views,total_visitors:baseline+visitors};}
  sign(id){return createHmac('sha256',this.state.secret).update(id).digest('hex');}
  valid(token){
    if(!/^[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token||''))return false;
    const [id,signature]=token.split('.');return timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(this.sign(id),'hex'));
  }
  record(cookie=''){
    const operation=this.chain.then(async()=>{
      const token=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('obs_visitor='))?.slice(12);
      const known=this.valid(token),next={...this.state,views:this.state.views+1,visitors:this.state.visitors+(known?0:1)};
      await this.save(next);this.state=next;
      const id=known?null:randomBytes(16).toString('hex');
      return {stats:this.summary(),cookie:id?`${id}.${this.sign(id)}`:null};
    });
    this.chain=operation.catch(()=>{});return operation;
  }
}
