// Crea/actualiza el usuario admin por defecto (upsert, se puede correr las
// veces que sea). Se corre con "npm run prisma:seed" en desarrollo y lo
// corre solo el release al arrancar (iniciar.js), despues de aplicar las
// migraciones. JS plano y no TS a proposito: asi el release lo ejecuta con
// node sin necesitar ts-node ni compilar nada.
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'femcentral@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Femcentral2026*';

async function main() {
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const usuario = await prisma.usuario.upsert({
      where: { email: ADMIN_EMAIL },
      update: { passwordHash, rol: 'admin', activo: true },
      create: { email: ADMIN_EMAIL, passwordHash, rol: 'admin', activo: true },
    });
    console.log(`Usuario admin listo: ${usuario.email} (id=${usuario.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
