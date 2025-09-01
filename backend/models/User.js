const pool = require('../config/database');
const bcrypt = require('bcrypt');

class User {
  constructor(userData) {
    this.id = userData.id;
    this.name = userData.name;
    this.email = userData.email;
    this.password = userData.password;
    this.userType = userData.user_type || 'student';
    this.studentId = userData.student_id;
    this.department = userData.department;
    this.course = userData.course;
    this.phone = userData.phone;
    this.isActive = userData.is_active !== false;
    this.profileImage = userData.profile_image;
    this.maxActiveLoans = userData.max_active_loans || 2;
    this.lastLogin = userData.last_login;
    this.createdAt = userData.created_at;
    this.updatedAt = userData.updated_at;
  }

  // Criar novo usuário
  static async create(userData) {
    const { name, email, password, userType = 'student', studentId, department, course, phone } = userData;
    
    // Hash da senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const query = `
      INSERT INTO users (name, email, password, user_type, student_id, department, course, phone, is_active, max_active_loans, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, NOW(), NOW())
      RETURNING *
    `;

    const maxLoans = userType === 'professor' ? 5 : userType === 'admin' ? 10 : 2;
    const values = [name, email, hashedPassword, userType, studentId, department, course, phone, maxLoans];

    try {
      const result = await pool.query(query, values);
      return new User(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Email já cadastrado no sistema');
      }
      throw error;
    }
  }

  // Buscar usuário por ID
  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  // Buscar usuário por email
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    const result = await pool.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  // Buscar usuário por student_id
  static async findByStudentId(studentId) {
    const query = 'SELECT * FROM users WHERE student_id = $1 AND is_active = true';
    const result = await pool.query(query, [studentId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  // Listar usuários com paginação
  static async findAll(options = {}) {
    const { page = 1, limit = 20, search = '', userType = '', department = '' } = options;
    const offset = (page - 1) * limit;

    let whereConditions = ['is_active = true'];
    let values = [];
    let valueIndex = 1;

    if (search) {
      whereConditions.push(`(name ILIKE $${valueIndex} OR email ILIKE $${valueIndex} OR student_id ILIKE $${valueIndex})`);
      values.push(`%${search}%`);
      valueIndex++;
    }

    if (userType) {
      whereConditions.push(`user_type = $${valueIndex}`);
      values.push(userType);
      valueIndex++;
    }

    if (department) {
      whereConditions.push(`department = $${valueIndex}`);
      values.push(department);
      valueIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Query para buscar usuários
    const usersQuery = `
      SELECT * FROM users 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $${valueIndex} OFFSET $${valueIndex + 1}
    `;
    values.push(limit, offset);

    // Query para contar total
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countValues = values.slice(0, -2); // Remove limit e offset

    const [usersResult, countResult] = await Promise.all([
      pool.query(usersQuery, values),
      pool.query(countQuery, countValues)
    ]);

    const users = usersResult.rows.map(row => new User(row));
    const total = parseInt(countResult.rows[0].count);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Atualizar dados do usuário
  async update(updateData) {
    const allowedFields = ['name', 'phone', 'department', 'course', 'profile_image', 'max_active_loans'];
    const updates = [];
    const values = [];
    let valueIndex = 1;

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updates.push(`${key} = $${valueIndex}`);
        values.push(updateData[key]);
        valueIndex++;
      }
    });

    if (updates.length === 0) {
      throw new Error('Nenhum campo válido para atualização');
    }

    updates.push(`updated_at = NOW()`);
    values.push(this.id);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${valueIndex} AND is_active = true
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Usuário não encontrado');
    }

    // Atualizar propriedades da instância atual
    const updatedUser = result.rows[0];
    Object.assign(this, updatedUser);

    return this;
  }

  // Alterar senha
  async changePassword(currentPassword, newPassword) {
    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(currentPassword, this.password);
    if (!isValidPassword) {
      throw new Error('Senha atual incorreta');
    }

    // Hash da nova senha
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    const query = `
      UPDATE users 
      SET password = $1, updated_at = NOW() 
      WHERE id = $2 AND is_active = true
      RETURNING id
    `;

    const result = await pool.query(query, [hashedNewPassword, this.id]);
    
    if (result.rows.length === 0) {
      throw new Error('Erro ao atualizar senha');
    }

    this.password = hashedNewPassword;
    return true;
  }

  // Verificar senha
  async verifyPassword(password) {
    return await bcrypt.compare(password, this.password);
  }

  // Desativar usuário (soft delete)
  async deactivate() {
    const query = `
      UPDATE users 
      SET is_active = false, updated_at = NOW() 
      WHERE id = $1
      RETURNING id
    `;

    const result = await pool.query(query, [this.id]);
    
    if (result.rows.length === 0) {
      throw new Error('Usuário não encontrado');
    }

    this.isActive = false;
    return true;
  }

  // Atualizar último login
  async updateLastLogin() {
    const query = `
      UPDATE users 
      SET last_login = NOW(), updated_at = NOW() 
      WHERE id = $1
      RETURNING last_login
    `;

    const result = await pool.query(query, [this.id]);
    this.lastLogin = result.rows[0].last_login;
    return this.lastLogin;
  }

  // Verificar se usuário pode fazer empréstimo
  async canBorrow() {
    const activeLoansQuery = `
      SELECT COUNT(*) as active_loans
      FROM transactions 
      WHERE user_id = $1 AND status = 'active'
    `;

    const result = await pool.query(activeLoansQuery, [this.id]);
    const activeLoans = parseInt(result.rows[0].active_loans);

    return {
      canBorrow: activeLoans < this.maxActiveLoans,
      activeLoans,
      maxLoans: this.maxActiveLoans,
      availableSlots: this.maxActiveLoans - activeLoans
    };
  }

  // Buscar empréstimos ativos do usuário
  async getActiveLoans() {
    const query = `
      SELECT t.*, l.locker_number, c.name as cabinet_name, c.location, e.name as equipment_name
      FROM transactions t
      JOIN lockers l ON t.locker_id = l.id
      JOIN cabinets c ON l.cabinet_id = c.id
      LEFT JOIN equipment e ON t.equipment_id = e.id
      WHERE t.user_id = $1 AND t.status = 'active'
      ORDER BY t.borrowed_at DESC
    `;

    const result = await pool.query(query, [this.id]);
    return result.rows;
  }

  // Buscar histórico de empréstimos
  async getTransactionHistory(options = {}) {
    const { page = 1, limit = 20, status = '' } = options;
    const offset = (page - 1) * limit;

    let whereConditions = ['t.user_id = $1'];
    let values = [this.id];
    let valueIndex = 2;

    if (status) {
      whereConditions.push(`t.status = $${valueIndex}`);
      values.push(status);
      valueIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT t.*, l.locker_number, c.name as cabinet_name, c.location, e.name as equipment_name
      FROM transactions t
      JOIN lockers l ON t.locker_id = l.id
      JOIN cabinets c ON l.cabinet_id = c.id
      LEFT JOIN equipment e ON t.equipment_id = e.id
      WHERE ${whereClause}
      ORDER BY t.borrowed_at DESC
      LIMIT $${valueIndex} OFFSET $${valueIndex + 1}
    `;

    values.push(limit, offset);

    const [transactionsResult, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(`SELECT COUNT(*) FROM transactions t WHERE ${whereConditions.join(' AND ')}`, values.slice(0, -2))
    ]);

    return {
      transactions: transactionsResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    };
  }

  // Buscar estatísticas do usuário
  async getStats() {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_loans,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_loans,
        COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned_loans,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_loans,
        AVG(CASE 
          WHEN returned_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (returned_at - borrowed_at)) / 3600 
          END
        ) as avg_loan_duration_hours
      FROM transactions 
      WHERE user_id = $1
    `;

    const result = await pool.query(statsQuery, [this.id]);
    return result.rows[0];
  }

  // Verificar se usuário tem empréstimos em atraso
  async hasOverdueLoans() {
    const query = `
      SELECT COUNT(*) as overdue_count
      FROM transactions 
      WHERE user_id = $1 AND status = 'active' AND return_deadline < NOW()
    `;

    const result = await pool.query(query, [this.id]);
    return parseInt(result.rows[0].overdue_count) > 0;
  }

  // Buscar usuários com empréstimos em atraso (método estático para admin)
  static async getOverdueUsers() {
    const query = `
      SELECT DISTINCT u.*, COUNT(t.id) as overdue_count
      FROM users u
      JOIN transactions t ON u.id = t.user_id
      WHERE t.status = 'active' AND t.return_deadline < NOW()
      GROUP BY u.id, u.name, u.email, u.user_type, u.student_id, u.department, u.course, u.phone, u.is_active, u.profile_image, u.max_active_loans, u.last_login, u.created_at, u.updated_at
      ORDER BY overdue_count DESC, u.name
    `;

    const result = await pool.query(query);
    return result.rows.map(row => ({
      user: new User(row),
      overdueCount: parseInt(row.overdue_count)
    }));
  }

  // Método para serialização (remove senha antes de enviar para frontend)
  toJSON() {
    const userData = { ...this };
    delete userData.password;
    return userData;
  }

  // Validar dados do usuário
  static validate(userData) {
    const errors = [];

    if (!userData.name || userData.name.trim().length < 2) {
      errors.push('Nome deve ter pelo menos 2 caracteres');
    }

    if (!userData.email || !this.isValidEmail(userData.email)) {
      errors.push('Email inválido');
    }

    if (!userData.password || userData.password.length < 6) {
      errors.push('Senha deve ter pelo menos 6 caracteres');
    }

    const validUserTypes = ['student', 'professor', 'admin', 'staff'];
    if (userData.userType && !validUserTypes.includes(userData.userType)) {
      errors.push('Tipo de usuário inválido');
    }

    if (userData.studentId && userData.studentId.trim().length < 3) {
      errors.push('ID do estudante deve ter pelo menos 3 caracteres');
    }

    if (userData.phone && !this.isValidPhone(userData.phone)) {
      errors.push('Número de telefone inválido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validar email
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validar telefone
  static isValidPhone(phone) {
    const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
    return phoneRegex.test(phone);
  }

  // Buscar usuários por departamento
  static async findByDepartment(department) {
    const query = `
      SELECT * FROM users 
      WHERE department = $1 AND is_active = true
      ORDER BY name
    `;
    
    const result = await pool.query(query, [department]);
    return result.rows.map(row => new User(row));
  }

  // Buscar usuários com empréstimos ativos
  static async getActiveUsers() {
    const query = `
      SELECT DISTINCT u.*, COUNT(t.id) as active_loans
      FROM users u
      JOIN transactions t ON u.id = t.user_id
      WHERE t.status = 'active' AND u.is_active = true
      GROUP BY u.id, u.name, u.email, u.user_type, u.student_id, u.department, u.course, u.phone, u.is_active, u.profile_image, u.max_active_loans, u.last_login, u.created_at, u.updated_at
      ORDER BY active_loans DESC, u.name
    `;

    const result = await pool.query(query);
    return result.rows.map(row => ({
      user: new User(row),
      activeLoans: parseInt(row.active_loans)
    }));
  }

  // Buscar usuários mais ativos (estatística)
  static async getMostActiveUsers(limit = 10) {
    const query = `
      SELECT u.*, COUNT(t.id) as total_loans
      FROM users u
      LEFT JOIN transactions t ON u.id = t.user_id
      WHERE u.is_active = true
      GROUP BY u.id, u.name, u.email, u.user_type, u.student_id, u.department, u.course, u.phone, u.is_active, u.profile_image, u.max_active_loans, u.last_login, u.created_at, u.updated_at
      ORDER BY total_loans DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows.map(row => ({
      user: new User(row),
      totalLoans: parseInt(row.total_loans)
    }));
  }

  // Resetar senha (para admin)
  static async resetPassword(userId, newPassword) {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    const query = `
      UPDATE users 
      SET password = $1, updated_at = NOW() 
      WHERE id = $2 AND is_active = true
      RETURNING id, email
    `;

    const result = await pool.query(query, [hashedPassword, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Usuário não encontrado');
    }

    return result.rows[0];
  }

  // Verificar se usuário pode acessar cabinet específico
  async canAccessCabinet(cabinetId) {
    // Verificar se há restrições por tipo de usuário ou departamento
    const query = `
      SELECT 
        c.*,
        CASE 
          WHEN c.allowed_user_types IS NULL OR $2 = ANY(string_to_array(c.allowed_user_types, ',')) THEN true
          ELSE false
        END as type_allowed,
        CASE 
          WHEN c.allowed_departments IS NULL OR $3 = ANY(string_to_array(c.allowed_departments, ',')) THEN true
          ELSE false
        END as department_allowed
      FROM cabinets c
      WHERE c.id = $1 AND c.is_active = true
    `;

    const result = await pool.query(query, [cabinetId, this.userType, this.department]);
    
    if (result.rows.length === 0) {
      return { canAccess: false, reason: 'Cabinet não encontrado ou inativo' };
    }

    const cabinet = result.rows[0];
    
    if (!cabinet.type_allowed) {
      return { canAccess: false, reason: 'Tipo de usuário não autorizado para este cabinet' };
    }

    if (!cabinet.department_allowed) {
      return { canAccess: false, reason: 'Departamento não autorizado para este cabinet' };
    }

    // Verificar se pode fazer novos empréstimos
    const borrowCheck = await this.canBorrow();
    if (!borrowCheck.canBorrow) {
      return { canAccess: false, reason: 'Limite de empréstimos ativos atingido' };
    }

    // Verificar se tem empréstimos em atraso
    const hasOverdue = await this.hasOverdueLoans();
    if (hasOverdue) {
      return { canAccess: false, reason: 'Usuário possui empréstimos em atraso' };
    }

    return { canAccess: true, cabinet };
  }
}

module.exports = User;