-- CreateTable
CREATE TABLE "libros" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre_archivo" TEXT NOT NULL,
    "ruta_origen" TEXT NOT NULL,
    "periodo_libro" DATETIME,
    "total_paginas" INTEGER,
    "documentos_generados" INTEGER NOT NULL DEFAULT 0,
    "consecutivo_min" INTEGER,
    "consecutivo_max" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "error_detalle" TEXT,
    "iniciado_en" DATETIME,
    "finalizado_en" DATETIME
);

-- CreateTable
CREATE TABLE "personas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cedula" TEXT,
    "nombre" TEXT,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "libro_id" INTEGER,
    "origen" TEXT NOT NULL DEFAULT 'ocr',
    "persona_id" INTEGER,
    "consecutivo" TEXT NOT NULL,
    "consecutivo_num" INTEGER,
    "fecha" DATETIME,
    "periodo_libro" DATETIME,
    "revisar" BOOLEAN NOT NULL DEFAULT false,
    "motivo_revisar" TEXT,
    "pagina_inicio" INTEGER NOT NULL,
    "pagina_fin" INTEGER NOT NULL,
    "archivo_path" TEXT NOT NULL,
    "tamano_bytes" INTEGER,
    "hash_sha256" TEXT,
    "procesado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_en" DATETIME,
    CONSTRAINT "documentos_libro_id_fkey" FOREIGN KEY ("libro_id") REFERENCES "libros" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documentos_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'lector',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuario_id" INTEGER,
    "accion" TEXT NOT NULL,
    "documento_id" INTEGER,
    "detalle" TEXT,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "personas_cedula_key" ON "personas"("cedula");

-- CreateIndex
CREATE INDEX "documentos_consecutivo_num_idx" ON "documentos"("consecutivo_num");

-- CreateIndex
CREATE INDEX "documentos_fecha_idx" ON "documentos"("fecha");

-- CreateIndex
CREATE INDEX "documentos_persona_id_idx" ON "documentos"("persona_id");

-- CreateIndex
CREATE INDEX "documentos_libro_id_idx" ON "documentos"("libro_id");

-- CreateIndex
CREATE INDEX "documentos_revisar_idx" ON "documentos"("revisar");

-- CreateIndex
CREATE INDEX "documentos_eliminado_en_idx" ON "documentos"("eliminado_en");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
