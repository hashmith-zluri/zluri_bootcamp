const userRepository = require('../../src/repositories/user.repository');
const { query } = require('../../src/config/db');

jest.mock('../../src/config/db');

describe('UserRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedpassword',
        role: 'DEVELOPER'
      };
      query.mockResolvedValue({ rows: [mockUser] });

      const result = await userRepository.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(query).toHaveBeenCalledWith(
        'SELECT id, email, name, password, role FROM users WHERE email = $1',
        ['test@example.com']
      );
    });

    it('should return null when user not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await userRepository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'DEVELOPER'
      };
      query.mockResolvedValue({ rows: [mockUser] });

      const result = await userRepository.findById(1);

      expect(result).toEqual(mockUser);
      expect(query).toHaveBeenCalledWith(
        'SELECT id, email, name, role FROM users WHERE id = $1',
        [1]
      );
    });

    it('should return null when user not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await userRepository.findById(999);

      expect(result).toBeNull();
    });
  });
});
