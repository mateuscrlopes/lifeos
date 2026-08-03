import crypto from 'node:crypto';

const token = crypto.randomBytes(32).toString('base64url');
const hash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');

console.log('\nTOKEN DO APARELHO — guarde no Moto E, nao no Git:\n');
console.log(token);
console.log('\nHASH PARA O SUPABASE:\n');
console.log(hash);
console.log('\nSQL DE EXEMPLO:\n');
console.log(`insert into gumate_dispositivos (casa_id, usuario_id, nome, token_hash)\nselect casa_id, id, 'Moto E - Escritorio', '${hash}'\nfrom usuarios\nwhere lower(nome) like 'mateus%'\nlimit 1;`);
console.log('');
