
# 🔐 Smart Lock System

Sistema completo de gerenciamento de armários inteligentes para universidades e escolas, com controle de empréstimo de notebooks e equipamentos eletrônicos através de QR codes.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Características](#características)
- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso](#uso)
- [API Documentation](#api-documentation)
- [Hardware Integration](#hardware-integration)
- [Deploy](#deploy)
- [Contribuição](#contribuição)

## 🎯 Visão Geral

O Smart Lock System é uma solução completa que permite:

- **Usuários** escanearem QR codes dos armários
- **Seleção** individual de lockers disponíveis
- **Controle** automático de travas eletrônicas
- **Monitoramento** em tempo real de empréstimos
- **Histórico** completo de transações
- **Notificações** automáticas de lembretes e vencimentos

## ✨ Características

### 🎯 Funcionalidades Principais
- ✅ Scanner QR Code nativo
- ✅ Interface responsiva e intuitiva
- ✅ Controle de acesso por usuário
- ✅ Sistema de reservas
- ✅ Notificações push/email
- ✅ Relatórios e estatísticas
- ✅ Modo offline parcial
- ✅ Múltiplos tipos de usuário

### 🔧 Tecnologias
- **Frontend Web**: HTML5, CSS3, JavaScript (ES6+)
- **Mobile**: React Native
- **Backend**: Node.js + Express
- **Banco de Dados**: PostgreSQL
- **Comunicação**: WebSocket, REST API
- **Hardware**: Comunicação via HTTP/Serial/MQTT

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Web App       │    │   Admin Panel   │
│  (React Native) │    │ (HTML/CSS/JS)   │    │    (React)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴───────────────┐
                    │      Backend API            │
                    │    (Node.js + Express)      │
                    │                             │
                    │  ┌─────────┐ ┌─────────┐   │
                    │  │   JWT   │ │WebSocket│   │
                    │  │  Auth   │ │ Server  │   │
                    │  └─────────┘ └─────────┘   │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────┴───────────────┐
                    │      PostgreSQL             │
                    │     Database                │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────┴───────────────┐
                    │    Hardware Controllers     │
                    │                             │
                    │ ┌──────────┐ ┌──────────┐  │
                    │ │Arduino/  │ │ Solenoid │  │
                    │ │Raspberry │ │  Locks   │  │
                    │ │    Pi    │ │          │  │
                    │ └──────────┘ └──────────┘  │
                    └─────────────────────────────┘
```

## 📋 Pré-requisitos

### Sistema
- **Node.js** >= 16.0.0
- **PostgreSQL** >= 12.0
- **Redis** (opcional, para cache)

### Mobile Development
- **React Native CLI** >= 0.72
- **Android Studio** (para Android)
- **Xcode** (para iOS)

### Hardware
- **Controladores** compatíveis (Arduino, Raspberry Pi, etc.)
- **Fechaduras eletrônicas** (solenoides, servo motors)
- **Sensores** de porta (opcional)
- **Rede WiFi** estável

## 🚀 Instalação

### 1. Backend API

```bash
# Clone o repositório
git clone https://github.com/sua-universidade/smart-lock-system.git
cd smart-lock-system

# Instalar dependências do backend
cd backend
npm install

# Instalar dependências globais
npm install -g nodemon pm2
```

#### Dependências do Backend (package.json)

```json
{
  "name": "smart-lock-api",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.1",
    "pg": "^8.11.1",
    "ws": "^8.13.0",
    "express-rate-limit": "^6.8.1",
    "dotenv": "^16.3.1",
    "multer": "^1.4.5",
    "nodemailer": "^6.9.3",
    "node-cron": "^3.0.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.1",
    "supertest": "^6.3.3"
  }
}
```

### 2. Banco de Dados

```bash
# Instalar PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Criar banco de dados
sudo -u postgres createdb smartlock
sudo -u postgres createuser smartlock_user

# Configurar senha
sudo -u postgres psql -c "ALTER USER smartlock_user PASSWORD 'sua_senha_forte';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE smartlock TO smartlock_user;"

# Executar scripts de criação
psql -U smartlock_user -d smartlock -f database/setup.sql
```

### 3. Aplicativo Mobile

```bash
# Instalar React Native CLI
npm install -g @react-native-community/cli

# Navegar para pasta do mobile
cd mobile

# Instalar dependências
npm install

# Para iOS (somente macOS)
cd ios && pod install && cd ..

# Para Android, verificar configurações no Android Studio
```

#### Dependências do Mobile (package.json)

```json
{
  "name": "SmartLockApp",
  "version": "1.0.0",
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.72.3",
    "@react-navigation/native": "^6.1.7",
    "@react-navigation/stack": "^6.3.17",
    "@react-navigation/bottom-tabs": "^6.5.8",
    "react-native-camera-kit": "^13.0.0",
    "react-native-vector-icons": "^10.0.0",
    "@react-native-async-storage/async-storage": "^1.19.1",
    "react-native-push-notification": "^8.1.1",
    "@react-native-community/netinfo": "^9.4.1",
    "react-native-linear-gradient": "^2.8.1",
    "react-native-gesture-handler": "^2.12.1",
    "react-native-safe-area-context": "^4.7.1",
    "react-native-screens": "^3.22.1"
  }
}
```

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env` no backend:

```env
# Database
DATABASE_URL=postgresql://smartlock_user:sua_senha_forte@localhost:5432/smartlock

# JWT
JWT_SECRET=seu_jwt_secret_muito_forte_aqui_2025
JWT_EXPIRES_IN=8h

# Server
PORT=3001
NODE_ENV=production

# Email (para notificações)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sistema@suauniversidade.edu.br
SMTP_PASS=sua_senha_app

# Hardware
HARDWARE_TIMEOUT=5000
DEFAULT_UNLOCK_DURATION=30

# Redis (opcional)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
LOG_FILE=logs/smartlock.log
```

### 2. Configuração do Mobile

Edite `mobile/src/config/api.js`:

```javascript
export const API_CONFIG = {
  BASE_URL: __DEV__ 
    ? 'http://10.0.2.2:3001'  // Android Emulator
    : 'https://api.smartlock.suauniversidade.edu.br',
  
  WS_URL: __DEV__
    ? 'ws://10.0.2.2:3001/ws'
    : 'wss://api.smartlock.suauniversidade.edu.br/ws',
    
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3
};
```

### 3. Permissões (Android)

Adicione no `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

### 4. Configuração do Hardware

Exemplo para Arduino com ESP32:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "WiFi_Universidade";
const char* password = "senha_wifi";
const char* serverURL = "https://api.smartlock.edu.br";

// Definir pinos dos solenoides
const int LOCK_PINS[] = {2, 4, 5, 18, 19, 21, 22, 23};
const int NUM_LOCKERS = 8;

void setup() {
  Serial.begin(115200);
  
  // Configurar pinos
  for(int i = 0; i < NUM_LOCKERS; i++) {
    pinMode(LOCK_PINS[i], OUTPUT);
    digitalWrite(LOCK_PINS[i], LOW); // Travado por padrão
  }
  
  // Conectar WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Conectando ao WiFi...");
  }
  
  Serial.println("WiFi conectado!");
  Serial.println(WiFi.localIP());
}

void unlockLocker(int lockerNum, int duration) {
  if(lockerNum < 1 || lockerNum > NUM_LOCKERS) return;
  
  int pin = LOCK_PINS[lockerNum - 1];
  
  // Destravar
  digitalWrite(pin, HIGH);
  Serial.printf("Locker %d destravado por %d segundos\n", lockerNum, duration);
  
  // Aguardar
  delay(duration * 1000);
  
  // Travar novamente
  digitalWrite(pin, LOW);
  Serial.printf("Locker %d travado automaticamente\n", lockerNum);
}
```

## 🖥️ Uso

### 1. Iniciar o Backend

```bash
cd backend

# Desenvolvimento
npm run dev

# Produção
npm start

# Com PM2 (recomendado para produção)
pm2 start ecosystem.config.js
```

### 2. Executar o Mobile

```bash
cd mobile

# Android
npx react-native run-android

# iOS
npx react-native run-ios

# Metro bundler (em terminal separado)
npx react-native start
```

### 3. Fluxo de Uso

1. **Login**: Usuário faz login com credenciais universitárias
2. **Scan**: Escaneia QR code do armário desejado
3. **Seleção**: Escolhe o locker preferido entre os disponíveis
4. **Confirmação**: Confirma o empréstimo
5. **Desbloqueio**: Sistema destrava o locker por 30 segundos
6. **Retirada**: Usuário retira o equipamento
7. **Devolução**: Quando necessário, escaneia novamente para devolver

## 📚 API Documentation

### Autenticação

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "aluno@universidade.edu.br",
  "password": "senha123"
}

# Resposta
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "name": "João Silva",
    "email": "joao@universidade.edu.br",
    "userType": "student"
  }
}
```

### Validar QR Code

```bash
POST /api/qr/validate
Authorization: Bearer {token}
Content-Type: application/json

{
  "qrCode": "CABINET_CAB001_ACCESS"
}

# Resposta
{
  "valid": true,
  "cabinetId": "CAB001",
  "action": "ACCESS",
  "cabinet": {
    "id": "CAB001",
    "location": "Lab Informática - Sala 101",
    "description": "Notebooks Dell"
  }
}
```

### Realizar Empréstimo

```bash
POST /api/lockers/borrow
Authorization: Bearer {token}
Content-Type: application/json

{
  "cabinetId": "CAB001",
  "lockerNumber": "05"
}

# Resposta
{
  "success": true,
  "transactionId": 123,
  "borrowedAt": "2025-08-19T14:30:00.000Z",
  "returnDeadline": "2025-08-19T18:30:00.000Z",
  "unlockDuration": 30,
  "message": "Locker destravado com sucesso!"
}
```

### Obter Histórico

```bash
GET /api/history/user?page=1&limit=20
Authorization: Bearer {token}

# Resposta
{
  "transactions": [
    {
      "id": 123,
      "equipment": "Dell Inspiron 15",
      "cabinet_location": "Lab Informática",
      "locker_number": "05",
      "borrowed_at": "2025-08-19T14:30:00.000Z",
      "return_deadline": "2025-08-19T18:30:00.000Z",
      "status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15
  }
}
```

## 🔧 Hardware Integration

### Tipos de Controladores Suportados

1. **Arduino/ESP32**: Comunicação via HTTP
2. **Raspberry Pi**: Comunicação via HTTP/MQTT
3. **Controladores Comerciais**: Protocolo personalizado

### Exemplo de Integração

```javascript
// backend/controllers/hardwareController.js
class HardwareController {
  static async unlockLocker(cabinetId, lockerNumber, duration = 30) {
    const cabinet = await Cabinet.findById(cabinetId);
    
    if (!cabinet.hardware_ip) {
      throw new Error('Hardware não configurado');
    }
    
    try {
      const response = await fetch(`http://${cabinet.hardware_ip}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locker: lockerNumber,
          duration: duration,
          token: process.env.HARDWARE_TOKEN
        }),
        timeout: 5000
      });
      
      if (!response.ok) {
        throw new Error('Falha na comunicação com hardware');
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('Erro no hardware:', error);
      throw error;
    }
  }
}
```

## 🚀 Deploy

### 1. Backend (usando PM2)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Configurar ecosystem.config.js
module.exports = {
  apps: [{
    name: 'smart-lock-api',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};

# Iniciar aplicação
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 2. Banco de Dados (Backup e Restore)

```bash
# Backup
pg_dump -U smartlock_user -d smartlock > backup.sql

# Restore
psql -U smartlock_user -d smartlock < backup.sql

# Backup automático (adicionar ao cron)
0 2 * * * pg_dump -U smartlock_user smartlock > /backups/smartlock_$(date +\%Y\%m\%d).sql
```

### 3. Mobile App (Build para Produção)

```bash
# Android
cd android
./gradlew assembleRelease

# iOS
cd ios
xcodebuild -workspace SmartLockApp.xcworkspace -scheme SmartLockApp -configuration Release archive
```

### 4. Nginx (Reverse Proxy)

```nginx
server {
    listen 80;
    server_name api.smartlock.suauniversidade.edu.br;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

## 📊 Monitoramento

### 1. Logs do Sistema

```bash
# Ver logs do PM2
pm2 logs

# Ver logs específicos
tail -f logs/smartlock.log

# Análise de logs
grep "ERROR" logs/smartlock.log | tail -20
```

### 2. Métricas de Performance

```javascript
// backend/middleware/metrics.js
const metrics = {
  requests: 0,
  errors: 0,
  unlocks: 0,
  averageResponseTime: 0
};

app.use('/api', (req, res, next) => {
  const start = Date.now();
  
  metrics.requests++;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.averageResponseTime = 
      (metrics.averageResponseTime + duration) / 2;
  });
  
  next();
});
```

### 3. Health Check

```javascript
app.get('/health', async (req, res) => {
  try {
    // Verificar banco de dados
    await pool.query('SELECT 1');
    
    // Verificar hardware (opcional)
    // await pingHardware();
    
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

## 🛠️ Manutenção

### Tarefas Rotineiras

```bash
# Limpeza de logs antigos (executar mensalmente)
find logs/ -name "*.log" -mtime +30 -delete

# Backup do banco de dados (executar diariamente)
pg_dump smartlock > backups/smartlock_$(date +%Y%m%d).sql

# Limpeza de dados antigos (executar semanalmente)
psql -d smartlock -c "SELECT cleanup_old_logs(90);"

# Atualização de dependências (executar mensalmente)
npm audit fix
npm update
```

### Troubleshooting

**Problema**: Locker não destravar
```bash
# 1. Verificar conectividade com hardware
curl -X POST http://192.168.1.101/status

# 2. Verificar logs do hardware
tail -f /var/log/hardware.log

# 3. Testar comando manual
curl -X POST http://192.168.1.101/unlock \
  -H "Content-Type: application/json" \
  -d '{"locker": "01", "duration": 5}'
```

**Problema**: App não conecta com API
```bash
# 1. Verificar status da API
curl http://localhost:3001/health

# 2. Verificar logs da aplicação
pm2 logs smart-lock-api

# 3. Verificar conectividade de rede
ping api.smartlock.edu.br
```

## 🤝 Contribuição

### Como Contribuir

1. **Fork** do repositório
2. **Clone** seu fork localmente
3. **Crie** uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
4. **Commit** suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
5. **Push** para a branch (`git push origin feature/nova-funcionalidade`)
6. **Abra** um Pull Request

### Padrões de Código

```javascript
// Exemplo de padrão para APIs
app.post('/api/resource', authenticateToken, async (req, res) => {
  try {
    // Validação de entrada
    const { field1, field2 } = req.body;
    
    if (!field1 || !field2) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios não preenchidos' 
      });
    }
    
    // Lógica de negócio
    const result = await Service.create({ field1, field2 });
    
    // Log da operação
    console.log(`Resource criado: ${result.id} por usuário ${req.user.userId}`);
    
    // Resposta padronizada
    res.status(201).json({
      success: true,
      data: result,
      message: 'Resource criado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro na criação:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});
```

### Testes

```javascript
// tests/api.test.js
const request = require('supertest');
const app = require('../app');

describe('Smart Lock API', () => {
  let authToken;
  
  beforeAll(async () => {
    // Setup do banco de teste
    await setupTestDatabase();
    
    // Login para obter token
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@university.edu',
        password: 'test123'
      });
    
    authToken = response.body.token;
  });
  
  describe('POST /api/qr/validate', () => {
    it('deve validar QR code válido', async () => {
      const response = await request(app)
        .post('/api/qr/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          qrCode: 'CABINET_CAB001_ACCESS'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.cabinetId).toBe('CAB001');
    });
    
    it('deve rejeitar QR code inválido', async () => {
      const response = await request(app)
        .post('/api/qr/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          qrCode: 'INVALID_QR_CODE'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('inválido');
    });
  });
});

// Executar testes
npm test
```

## 📈 Roadmap

### Versão 1.1 (Próximos 3 meses)
- [ ] Sistema de reservas antecipadas
- [ ] Integração com LDAP/Active Directory
- [ ] Dashboard administrativo web
- [ ] Relatórios avançados em PDF
- [ ] Sistema de multas automáticas

### Versão 1.2 (Próximos 6 meses)
- [ ] Integração com sistema acadêmico
- [ ] Reconhecimento facial como backup
- [ ] App para smartwatches
- [ ] Sistema de manutenção preventiva
- [ ] API para integração com terceiros

### Versão 2.0 (Próximo ano)
- [ ] Inteligência artificial para otimização
- [ ] Suporte a múltiplas instituições
- [ ] Sistema de blockchain para auditoria
- [ ] Realidade aumentada para localização
- [ ] Integração IoT avançada

## 📋 FAQ

### Perguntas Frequentes

**Q: O sistema funciona offline?**
R: O app mobile tem funcionalidade limitada offline. Pode exibir histórico local, mas necessita conexão para validar QR codes e destravar lockers.

**Q: Quantos usuários simultâneos suporta?**
R: Com a configuração padrão, suporta até 1000 usuários simultâneos. Para mais usuários, considere cluster mode e load balancer.

**Q: Como funciona a integração com hardware?**
R: O sistema se comunica via HTTP/HTTPS com controladores que gerenciam as fechaduras eletrônicas. Suporta diversos tipos de hardware.

**Q: É possível personalizar o tempo de desbloqueio?**
R: Sim, configurável por tipo de usuário e equipamento. Padrão é 30 segundos, mas pode ser ajustado.

**Q: Como garantir a segurança dos equipamentos?**
R: Sistema usa autenticação JWT, logs completos, sensores de porta (opcional), e timeout automático para retravar.

**Q: Suporta múltiplas universidades?**
R: Atualmente, uma instância por instituição. Versão multi-tenant planejada para v2.0.

## 🔒 Segurança

### Medidas Implementadas

1. **Autenticação JWT** com expiração
2. **Rate limiting** para prevenir ataques
3. **Validação** rigorosa de entrada
4. **Logs** completos de auditoria
5. **Comunicação** criptografada (HTTPS/WSS)
6. **Sanitização** de dados do banco

### Configurações de Segurança

```javascript
// Configuração de segurança no backend
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Headers de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting por IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests
  message: 'Muitas tentativas, tente novamente mais tarde',
});

app.use('/api/', limiter);

// Rate limiting específico para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // máximo 5 tentativas de login
  skipSuccessfulRequests: true,
});

app.use('/api/auth/login', loginLimiter);
```

## 📞 Suporte

### Canais de Suporte

- **Email**: suporte@smartlock.suauniversidade.edu.br
- **Documentação**: [docs.smartlock.edu.br](https://docs.smartlock.edu.br)
- **Issues**: [GitHub Issues](https://github.com/sua-universidade/smart-lock-system/issues)
- **Discord**: [Comunidade Smart Lock](https://discord.gg/smartlock)

### Horários de Suporte

- **Segunda a Sexta**: 8h às 18h
- **Emergências**: 24/7 (apenas para falhas críticas)
- **Tempo de resposta**: 
  - Crítico: 2 horas
  - Alto: 8 horas
  - Médio: 24 horas
  - Baixo: 72 horas

## 📄 Licença

```
MIT License

Copyright (c) 2025 Smart Lock System

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🙏 Agradecimentos

- **Universidade XYZ** pelo apoio ao projeto
- **Departamento de TI** pela infraestrutura
- **Comunidade Open Source** pelas bibliotecas utilizadas
- **Beta Testers** pelos feedbacks valiosos

---

## 📱 Screenshots do Sistema

### App Mobile

<div align="center">
  <img src="docs/images/login-screen.png" alt="Tela de Login" width="200"/>
  <img src="docs/images/qr-scanner.png" alt="Scanner QR" width="200"/>
  <img src="docs/images/locker-selection.png" alt="Seleção de Locker" width="200"/>
  <img src="docs/images/success-screen.png" alt="Sucesso" width="200"/>
</div>

### Dashboard Web

<div align="center">
  <img src="docs/images/dashboard-overview.png" alt="Dashboard Principal" width="600"/>
  <img src="docs/images/cabinet-management.png" alt="Gerenciamento de Armários" width="600"/>
</div>

---

**Smart Lock System** - Desenvolvido com ❤️ para facilitar o acesso a equipamentos universitários

**Versão atual**: 1.0.0  
**Última atualização**: Agosto 2025  
**Próxima versão**: 1.1.0 (Novembro 2025)