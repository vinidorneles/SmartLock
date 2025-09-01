const pool = require('../config/database');

class Cabinet {
  constructor(cabinetData) {
    this.id = cabinetData.id;
    this.name = cabinetData.name;
    this.location = cabinetData.location;
    this.description = cabinetData.description;
    this.qrCode = cabinetData.qr_code;
    this.hardwareIp = cabinetData.hardware_ip;
    this.hardwareType = cabinetData.hardware_type || 'esp32';
    this.totalLockers = cabinetData.total_lockers;
    this.allowedUserTypes = cabinetData.allowed_user_types ? cabinetData.allowed_user_types.split(',') : [];
    this.allowedDepartments = cabinetData.allowed_departments ? cabinetData.allowed_departments.split(',') : [];
    this.maxLoanDuration = cabinetData.max_loan_duration || 240; // minutos
    this.requiresApproval = cabinetData.requires_approval || false;
    this.isActive = cabinetData.is_active !== false;
    this.maintenanceMode = cabinetData.maintenance_mode || false;
    this.lastHealthCheck = cabinetData.last_health_check;
    this.createdAt = cabinetData.created_at;
    this.updatedAt = cabinetData.updated_at;
  }

  // Criar novo cabinet
  static async create(cabinetData) {
    const {
      name,
      location,
      description,
      qrCode,
      hardwareIp,
      hardwareType = 'esp32',
      totalLockers,
      allowedUserTypes = [],
      allowedDepartments = [],
      maxLoanDuration = 240,
      requiresApproval = false
    } = cabinetData;

    const query = `
      INSERT INTO cabinets (
        name, location, description, qr_code, hardware_ip, hardware_type,
        total_lockers, allowed_user_types, allowed_departments, 
        max_loan_duration, requires_approval, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      name,
      location,
      description,
      qrCode,
      hardwareIp,
      hardwareType,
      totalLockers,
      allowedUserTypes.length > 0 ? allowedUserTypes.join(',') : null,
      allowedDepartments.length > 0 ? allowedDepartments.join(',') : null,
      maxLoanDuration,
      requiresApproval
    ];

    try {
      const result = await pool.query(query, values);
      return new Cabinet(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        if (error.constraint === 'cabinets_qr_code_key') {
          throw new Error('QR Code já existe no sistema');
        }
        if (error.constraint === 'cabinets_hardware_ip_key') {
          throw new Error('IP do hardware já está em uso');
        }
      }
      throw error;
    }
  }

  // Buscar cabinet por ID
  static async findById(id) {
    const query = 'SELECT * FROM cabinets WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Cabinet(result.rows[0]);
  }

  // Buscar cabinet por QR Code
  static async findByQrCode(qrCode) {
    const query = 'SELECT * FROM cabinets WHERE qr_code = $1 AND is_active = true';
    const result = await pool.query(query, [qrCode]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Cabinet(result.rows[0]);
  }

  // Listar todos os cabinets
  static async findAll(options = {}) {
    const { page = 1, limit = 20, search = '', location = '', isActive = true } = options;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let values = [];
    let valueIndex = 1;

    if (isActive !== undefined) {
      whereConditions.push(`is_active = $${valueIndex}`);
      values.push(isActive);
      valueIndex++;
    }

    if (search) {
      whereConditions.push(`(name ILIKE $${valueIndex} OR description ILIKE $${valueIndex} OR location ILIKE $${valueIndex})`);
      values.push(`%${search}%`);
      valueIndex++;
    }

    if (location) {
      whereConditions.push(`location ILIKE $${valueIndex}`);
      values.push(`%${location}%`);
      valueIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const cabinetsQuery = `
      SELECT * FROM cabinets 
      ${whereClause}
      ORDER BY location, name 
      LIMIT $${valueIndex} OFFSET $${valueIndex + 1}
    `;
    values.push(limit, offset);

    const countQuery = `SELECT COUNT(*) FROM cabinets ${whereClause}`;
    const countValues = values.slice(0, -2);

    const [cabinetsResult, countResult] = await Promise.all([
      pool.query(cabinetsQuery, values),
      pool.query(countQuery, countValues)
    ]);

    const cabinets = cabinetsResult.rows.map(row => new Cabinet(row));
    const total = parseInt(countResult.rows[0].count);

    return {
      cabinets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Buscar cabinets com estatísticas de uso
  static async findAllWithStats() {
    const query = `
      SELECT 
        c.*,
        COUNT(l.id) as total_lockers_count,
        COUNT(CASE WHEN l.status = 'available' THEN 1 END) as available_lockers,
        COUNT(CASE WHEN l.status = 'occupied' THEN 1 END) as occupied_lockers,
        COUNT(CASE WHEN l.status = 'maintenance' THEN 1 END) as maintenance_lockers,
        COUNT(t.id) as total_transactions,
        COUNT(CASE WHEN t.status = 'active' THEN 1 END) as active_transactions
      FROM cabinets c
      LEFT JOIN lockers l ON c.id = l.cabinet_id
      LEFT JOIN transactions t ON l.id = t.locker_id
      WHERE c.is_active = true
      GROUP BY c.id, c.name, c.location, c.description, c.qr_code, c.hardware_ip, c.hardware_type, c.total_lockers, c.allowed_user_types, c.allowed_departments, c.max_loan_duration, c.requires_approval, c.is_active, c.maintenance_mode, c.last_health_check, c.created_at, c.updated_at
      ORDER BY c.location, c.name
    `;

    const result = await pool.query(query);
    return result.rows.map(row => ({
      cabinet: new Cabinet(row),
      stats: {
        totalLockers: parseInt(row.total_lockers_count) || 0,
        availableLockers: parseInt(row.available_lockers) || 0,
        occupiedLockers: parseInt(row.occupied_lockers) || 0,
        maintenanceLockers: parseInt(row.maintenance_lockers) || 0,
        totalTransactions: parseInt(row.total_transactions) || 0,
        activeTransactions: parseInt(row.active_transactions) || 0,
        occupancyRate: row.total_lockers_count > 0 ? 
          (parseInt(row.occupied_lockers) / parseInt(row.total_lockers_count) * 100).toFixed(1) : 0
      }
    }));
  }

  // Atualizar cabinet
  async update(updateData) {
    const allowedFields = [
      'name', 'location', 'description', 'hardware_ip', 'hardware_type',
      'allowed_user_types', 'allowed_departments', 'max_loan_duration',
      'requires_approval', 'maintenance_mode'
    ];

    const updates = [];
    const values = [];
    let valueIndex = 1;

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        if (key === 'allowed_user_types' || key === 'allowed_departments') {
          // Converter array para string
          const arrayValue = Array.isArray(updateData[key]) ? updateData[key].join(',') : updateData[key];
          updates.push(`${key} = $${valueIndex}`);
          values.push(arrayValue || null);
        } else {
          updates.push(`${key} = $${valueIndex}`);
          values.push(updateData[key]);
        }
        valueIndex++;
      }
    });

    if (updates.length === 0) {
      throw new Error('Nenhum campo válido para atualização');
    }

    updates.push(`updated_at = NOW()`);
    values.push(this.id);

    const query = `
      UPDATE cabinets 
      SET ${updates.join(', ')} 
      WHERE id = ${valueIndex} AND is_active = true
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Cabinet não encontrado');
    }

    Object.assign(this, new Cabinet(result.rows[0]));
    return this;
  }

  // Buscar lockers do cabinet
  async getLockers() {
    const Locker = require('./Locker');
    return await Locker.findByCabinetId(this.id);
  }

  // Buscar lockers disponíveis
  async getAvailableLockers() {
    const query = `
      SELECT * FROM lockers 
      WHERE cabinet_id = $1 AND status = 'available' AND is_active = true
      ORDER BY locker_number
    `;

    const result = await pool.query(query, [this.id]);
    return result.rows;
  }

  // Verificar status do hardware
  async checkHardwareStatus() {
    if (!this.hardwareIp) {
      return { online: false, error: 'IP do hardware não configurado' };
    }

    try {
      const fetch = require('node-fetch');
      const response = await fetch(`http://${this.hardwareIp}/status`, {
        method: 'GET',
        timeout: 5000
      });

      if (response.ok) {
        const status = await response.json();
        
        // Atualizar último health check
        await this.updateHealthCheck();
        
        return {
          online: true,
          ...status
        };
      } else {
        return {
          online: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        online: false,
        error: error.message
      };
    }
  }

  // Atualizar último health check
  async updateHealthCheck() {
    const query = `
      UPDATE cabinets 
      SET last_health_check = NOW(), updated_at = NOW() 
      WHERE id = $1
      RETURNING last_health_check
    `;

    const result = await pool.query(query, [this.id]);
    this.lastHealthCheck = result.rows[0].last_health_check;
    return this.lastHealthCheck;
  }

  // Alternar modo manutenção
  async toggleMaintenanceMode() {
    const query = `
      UPDATE cabinets 
      SET maintenance_mode = NOT maintenance_mode, updated_at = NOW() 
      WHERE id = $1
      RETURNING maintenance_mode
    `;

    const result = await pool.query(query, [this.id]);
    this.maintenanceMode = result.rows[0].maintenance_mode;
    return this.maintenanceMode;
  }

  // Buscar estatísticas de uso
  async getUsageStats(days = 30) {
    const query = `
      SELECT 
        DATE(t.borrowed_at) as date,
        COUNT(*) as daily_loans,
        COUNT(CASE WHEN t.status = 'returned' THEN 1 END) as daily_returns,
        AVG(EXTRACT(EPOCH FROM (t.returned_at - t.borrowed_at)) / 60) as avg_duration_minutes
      FROM transactions t
      JOIN lockers l ON t.locker_id = l.id
      WHERE l.cabinet_id = $1 
        AND t.borrowed_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(t.borrowed_at)
      ORDER BY date DESC
    `;

    const result = await pool.query(query, [this.id]);
    return result.rows;
  }

  // Verificar se usuário pode acessar este cabinet
  canUserAccess(user) {
    // Verificar se está ativo e não em manutenção
    if (!this.isActive || this.maintenanceMode) {
      return {
        canAccess: false,
        reason: this.maintenanceMode ? 'Cabinet em modo manutenção' : 'Cabinet inativo'
      };
    }

    // Verificar tipo de usuário
    if (this.allowedUserTypes.length > 0 && !this.allowedUserTypes.includes(user.userType)) {
      return {
        canAccess: false,
        reason: 'Tipo de usuário não autorizado'
      };
    }

    // Verificar departamento
    if (this.allowedDepartments.length > 0 && !this.allowedDepartments.includes(user.department)) {
      return {
        canAccess: false,
        reason: 'Departamento não autorizado'
      };
    }

    return { canAccess: true };
  }

  // Buscar equipamentos do cabinet
  async getEquipment() {
    const Equipment = require('./Equipment');
    return await Equipment.findByCabinetId(this.id);
  }

  // Desativar cabinet (soft delete)
  async deactivate() {
    const query = `
      UPDATE cabinets 
      SET is_active = false, updated_at = NOW() 
      WHERE id = $1
      RETURNING id
    `;

    const result = await pool.query(query, [this.id]);
    
    if (result.rows.length === 0) {
      throw new Error('Cabinet não encontrado');
    }

    this.isActive = false;
    return true;
  }

  // Validar dados do cabinet
  static validate(cabinetData) {
    const errors = [];

    if (!cabinetData.name || cabinetData.name.trim().length < 2) {
      errors.push('Nome deve ter pelo menos 2 caracteres');
    }

    if (!cabinetData.location || cabinetData.location.trim().length < 3) {
      errors.push('Localização deve ter pelo menos 3 caracteres');
    }

    if (!cabinetData.qrCode || cabinetData.qrCode.trim().length < 5) {
      errors.push('QR Code deve ter pelo menos 5 caracteres');
    }

    if (!cabinetData.hardwareIp || !this.isValidIP(cabinetData.hardwareIp)) {
      errors.push('IP do hardware inválido');
    }

    if (!cabinetData.totalLockers || cabinetData.totalLockers < 1 || cabinetData.totalLockers > 50) {
      errors.push('Número de lockers deve estar entre 1 e 50');
    }

    const validHardwareTypes = ['arduino', 'esp32', 'raspberry_pi', 'commercial'];
    if (cabinetData.hardwareType && !validHardwareTypes.includes(cabinetData.hardwareType)) {
      errors.push('Tipo de hardware inválido');
    }

    if (cabinetData.maxLoanDuration && (cabinetData.maxLoanDuration < 30 || cabinetData.maxLoanDuration > 1440)) {
      errors.push('Duração máxima do empréstimo deve estar entre 30 e 1440 minutos');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validar IP
  static isValidIP(ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  // Buscar cabinets próximos ao vencimento de health check
  static async getUnhealthyCabinets(hoursThreshold = 24) {
    const query = `
      SELECT * FROM cabinets 
      WHERE is_active = true 
        AND (
          last_health_check IS NULL 
          OR last_health_check < NOW() - INTERVAL '${hoursThreshold} hours'
        )
      ORDER BY last_health_check NULLS FIRST
    `;

    const result = await pool.query(query);
    return result.rows.map(row => new Cabinet(row));
  }

  // Gerar novo QR Code
  static generateQrCode(cabinetId) {
    const timestamp = Date.now();
    return `CABINET_${cabinetId}_ACCESS_${timestamp}`;
  }

  // Método para serialização
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      location: this.location,
      description: this.description,
      qrCode: this.qrCode,
      hardwareIp: this.hardwareIp,
      hardwareType: this.hardwareType,
      totalLockers: this.totalLockers,
      allowedUserTypes: this.allowedUserTypes,
      allowedDepartments: this.allowedDepartments,
      maxLoanDuration: this.maxLoanDuration,
      requiresApproval: this.requiresApproval,
      isActive: this.isActive,
      maintenanceMode: this.maintenanceMode,
      lastHealthCheck: this.lastHealthCheck,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Cabinet;