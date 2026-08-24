// No hay endpoint de registro (PLAN_API.md seccion 7.5 solo define login),
// asi que el primer usuario admin se crea con este script de una sola vez.
//
// Uso:
//   npx ts-node scripts/crear-usuario.ts admin@ejemplo.com "una-clave-segura" admin
//
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function main() {
  const [, , email, password, rol = 'admin'] = process.argv;

  if (!email || !password) {
    console.error('Uso: ts-node scripts/crear-usuario.ts <email> <password> [admin|editor|lector]');
    process.exit(1);
  }
  if (!['admin', 'editor', 'lector'].includes(rol)) {
    console.error(`Rol invalido: ${rol}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const usuario = await prisma.usuario.upsert({
      where: { email },
      update: { passwordHash, rol, activo: true },
      create: { email, passwordHash, rol, activo: true },
    });
    console.log(`Usuario listo: ${usuario.email} (rol=${usuario.rol}, id=${usuario.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
