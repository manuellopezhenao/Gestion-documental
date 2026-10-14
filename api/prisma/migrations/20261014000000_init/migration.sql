BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[libros] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre_archivo] NVARCHAR(1000) NOT NULL,
    [ruta_origen] NVARCHAR(1000) NOT NULL,
    [periodo_libro] DATETIME2,
    [total_paginas] INT,
    [documentos_generados] INT NOT NULL CONSTRAINT [libros_documentos_generados_df] DEFAULT 0,
    [consecutivo_min] INT,
    [consecutivo_max] INT,
    [estado] NVARCHAR(1000) NOT NULL CONSTRAINT [libros_estado_df] DEFAULT 'pendiente',
    [error_detalle] NVARCHAR(max),
    [iniciado_en] DATETIME2,
    [finalizado_en] DATETIME2,
    CONSTRAINT [libros_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[personas] (
    [id] INT NOT NULL IDENTITY(1,1),
    [cedula] NVARCHAR(50),
    [nombre] NVARCHAR(1000),
    [creado_en] DATETIME2 NOT NULL CONSTRAINT [personas_creado_en_df] DEFAULT CURRENT_TIMESTAMP,
    [actualizado_en] DATETIME2 NOT NULL,
    CONSTRAINT [personas_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [personas_cedula_key] UNIQUE NONCLUSTERED ([cedula])
);

-- CreateTable
CREATE TABLE [dbo].[documentos] (
    [id] INT NOT NULL IDENTITY(1,1),
    [libro_id] INT,
    [origen] NVARCHAR(1000) NOT NULL CONSTRAINT [documentos_origen_df] DEFAULT 'ocr',
    [persona_id] INT,
    [consecutivo] NVARCHAR(1000) NOT NULL,
    [consecutivo_num] INT,
    [fecha] DATETIME2,
    [periodo_libro] DATETIME2,
    [revisar] BIT NOT NULL CONSTRAINT [documentos_revisar_df] DEFAULT 0,
    [motivo_revisar] NVARCHAR(1000),
    [pagina_inicio] INT NOT NULL,
    [pagina_fin] INT NOT NULL,
    [archivo_path] NVARCHAR(1000) NOT NULL,
    [tamano_bytes] INT,
    [hash_sha256] NVARCHAR(1000),
    [procesado_en] DATETIME2 NOT NULL CONSTRAINT [documentos_procesado_en_df] DEFAULT CURRENT_TIMESTAMP,
    [eliminado_en] DATETIME2,
    CONSTRAINT [documentos_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[usuarios] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] NVARCHAR(255) NOT NULL,
    [password_hash] NVARCHAR(1000) NOT NULL,
    [rol] NVARCHAR(1000) NOT NULL CONSTRAINT [usuarios_rol_df] DEFAULT 'lector',
    [activo] BIT NOT NULL CONSTRAINT [usuarios_activo_df] DEFAULT 1,
    [creado_en] DATETIME2 NOT NULL CONSTRAINT [usuarios_creado_en_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [usuarios_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [usuarios_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[auditoria] (
    [id] INT NOT NULL IDENTITY(1,1),
    [usuario_id] INT,
    [accion] NVARCHAR(1000) NOT NULL,
    [documento_id] INT,
    [detalle] NVARCHAR(max),
    [fecha] DATETIME2 NOT NULL CONSTRAINT [auditoria_fecha_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [auditoria_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documentos_consecutivo_num_idx] ON [dbo].[documentos]([consecutivo_num]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documentos_fecha_idx] ON [dbo].[documentos]([fecha]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documentos_persona_id_idx] ON [dbo].[documentos]([persona_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documentos_libro_id_idx] ON [dbo].[documentos]([libro_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documentos_revisar_idx] ON [dbo].[documentos]([revisar]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documentos_eliminado_en_idx] ON [dbo].[documentos]([eliminado_en]);

-- AddForeignKey
ALTER TABLE [dbo].[documentos] ADD CONSTRAINT [documentos_libro_id_fkey] FOREIGN KEY ([libro_id]) REFERENCES [dbo].[libros]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[documentos] ADD CONSTRAINT [documentos_persona_id_fkey] FOREIGN KEY ([persona_id]) REFERENCES [dbo].[personas]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

