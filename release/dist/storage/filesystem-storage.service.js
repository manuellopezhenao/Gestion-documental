"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilesystemStorage = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs_1 = require("fs");
const path = __importStar(require("path"));
let FilesystemStorage = class FilesystemStorage {
    constructor(config) {
        const appConfig = config.get('app');
        this.root = path.resolve(process.cwd(), appConfig.storagePath);
    }
    resolverDentroDeRoot(rutaRelativa) {
        const destino = path.resolve(this.root, rutaRelativa);
        if (!destino.startsWith(this.root + path.sep) && destino !== this.root) {
            throw new Error(`Ruta fuera del storage permitido: ${rutaRelativa}`);
        }
        return destino;
    }
    async guardar(rutaRelativa, datos) {
        const destino = this.resolverDentroDeRoot(rutaRelativa);
        await fs_1.promises.mkdir(path.dirname(destino), { recursive: true });
        await fs_1.promises.writeFile(destino, datos);
    }
    async leer(rutaRelativa) {
        return fs_1.promises.readFile(this.resolverDentroDeRoot(rutaRelativa));
    }
    async existe(rutaRelativa) {
        try {
            await fs_1.promises.access(this.resolverDentroDeRoot(rutaRelativa));
            return true;
        }
        catch {
            return false;
        }
    }
    async eliminar(rutaRelativa) {
        await fs_1.promises.unlink(this.resolverDentroDeRoot(rutaRelativa));
    }
    raiz() {
        return this.root;
    }
    async estadisticas() {
        let archivos = 0;
        let bytes = 0;
        const recorrer = async (dir) => {
            let entradas;
            try {
                entradas = await fs_1.promises.readdir(dir, { withFileTypes: true });
            }
            catch {
                return;
            }
            for (const entrada of entradas) {
                const ruta = path.join(dir, entrada.name);
                if (entrada.isDirectory()) {
                    await recorrer(ruta);
                }
                else if (entrada.isFile()) {
                    archivos += 1;
                    bytes += (await fs_1.promises.stat(ruta)).size;
                }
            }
        };
        await recorrer(this.root);
        return { archivos, bytes };
    }
};
exports.FilesystemStorage = FilesystemStorage;
exports.FilesystemStorage = FilesystemStorage = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(config_1.ConfigService)),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FilesystemStorage);
//# sourceMappingURL=filesystem-storage.service.js.map