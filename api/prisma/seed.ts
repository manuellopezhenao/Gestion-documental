// Crea/actualiza el usuario admin por defecto. Prisma corre este script
// solo cuando se hace "migrate dev"/"migrate reset" por primera vez en
// una base nueva; en cualquier otro momento se puede disparar a mano con
// "npm run prisma:seed". Pensado para que al clonar el repo en una
// maquina nueva (equipo local) alcance con migrar + seed para tener el
// mismo admin, sin tener que mover el archivo .db (que no se versiona,
// ver .gitignore) ni recordar credenciales.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Se puede pisar por .env si algun dia se quiere otro admin por defecto;
// estos valores son el fallback para que el seed funcione aun sin ellos.
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

main();
