import { Global, Module } from '@nestjs/common';
import { STORAGE_TOKEN } from './storage.interface';
import { FilesystemStorage } from './filesystem-storage.service';

// Global + un solo provider detras del token STORAGE_TOKEN: el dia que se
// agregue S3Storage, este es el unico archivo que cambia.
@Global()
@Module({
  providers: [{ provide: STORAGE_TOKEN, useClass: FilesystemStorage }],
  exports: [STORAGE_TOKEN],
})
export class StorageModule {}
