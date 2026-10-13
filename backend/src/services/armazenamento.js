// Onde ficam as fotos dos anúncios: no disco do servidor (padrão) ou num armazenamento S3/R2.
// Use S3/R2 em hospedagens que apagam os arquivos a cada atualização (Render, Railway...).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PASTA_FOTOS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads', 'anuncios');
const env = (k) => process.env[k] || '';
const usaS3 = () => Boolean(env('FOTOS_S3_BUCKET'));
const TIPOS = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

let cliente = null;
async function s3() {
  if (cliente) return cliente;
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const c = new S3Client({
    region: env('FOTOS_S3_REGIAO') || 'auto',
    endpoint: env('FOTOS_S3_ENDPOINT') || undefined,        // R2: https://<conta>.r2.cloudflarestorage.com
    credentials: { accessKeyId: env('FOTOS_S3_CHAVE'), secretAccessKey: env('FOTOS_S3_SEGREDO') },
    forcePathStyle: Boolean(env('FOTOS_S3_ENDPOINT')),
  });
  cliente = { c, PutObjectCommand, DeleteObjectCommand };
  return cliente;
}

export function urlFoto(arquivo) {
  if (usaS3()) return `${env('FOTOS_URL_PUBLICA').replace(/\/$/, '')}/${arquivo}`;
  return `/fotos/${arquivo}`;
}

export async function salvarFoto(arquivo, buf, ext) {
  if (usaS3()) {
    const { c, PutObjectCommand } = await s3();
    await c.send(new PutObjectCommand({ Bucket: env('FOTOS_S3_BUCKET'), Key: arquivo, Body: buf, ContentType: TIPOS[ext], CacheControl: 'public, max-age=2592000' }));
    return;
  }
  fs.mkdirSync(PASTA_FOTOS, { recursive: true });
  fs.writeFileSync(path.join(PASTA_FOTOS, arquivo), buf);
}

export async function apagarFoto(arquivo) {
  if (usaS3()) {
    const { c, DeleteObjectCommand } = await s3();
    await c.send(new DeleteObjectCommand({ Bucket: env('FOTOS_S3_BUCKET'), Key: arquivo })).catch((e) => console.error(`[Fotos] não apagou ${arquivo}: ${e.message}`));
    return;
  }
  fs.rmSync(path.join(PASTA_FOTOS, arquivo), { force: true });
}

if (usaS3() && !env('FOTOS_URL_PUBLICA')) throw new Error('Com FOTOS_S3_BUCKET, defina também FOTOS_URL_PUBLICA (endereço público das fotos).');
