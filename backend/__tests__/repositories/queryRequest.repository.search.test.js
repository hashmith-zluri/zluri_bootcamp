const queryRequestRepository = require('../../src/repositories/queryRequest.repository');
const { query } = require('../../src/config/db');

jest.mock('../../src/config/db');

describe('QueryRequestRepository - Search Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByUserId with search', () => {
    it('should search by all fields when searchField is "all"', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: 'test search',
        searchField: 'all'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.id::text ILIKE $2 OR'),
        expect.arrayContaining([1, '%test search%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should search by all fields when searchField is not provided', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: 'test search'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.id::text ILIKE $2 OR'),
        expect.arrayContaining([1, '%test search%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should search by specific field - req_id', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: '123',
        searchField: 'req_id'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.id::text ILIKE $2'),
        expect.arrayContaining([1, '%123%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should search by specific field - database_name', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: 'testdb',
        searchField: 'database_name'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.database_name ILIKE $2'),
        expect.arrayContaining([1, '%testdb%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should search by specific field - instance_name', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: 'prod-instance',
        searchField: 'instance_name'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('di.name ILIKE $2'),
        expect.arrayContaining([1, '%prod-instance%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should search by specific field - pod', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: 'pod-1',
        searchField: 'pod'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.pod_id ILIKE $2'),
        expect.arrayContaining([1, '%pod-1%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should search by specific field - query', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: 'SELECT',
        searchField: 'query'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE(qr.query_text, qr.script_path) ILIKE $2'),
        expect.arrayContaining([1, '%SELECT%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should search by specific field - comments', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: 'urgent',
        searchField: 'comments'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.comments ILIKE $2'),
        expect.arrayContaining([1, '%urgent%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should search by specific field - created_at', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: '2024-01-15',
        searchField: 'created_at'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('TO_CHAR(qr.created_at, \'YYYY-MM-DD\') ILIKE $2'),
        expect.arrayContaining([1, '%2024-01-15%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should search by specific field - approved_at', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: '2024-01-16',
        searchField: 'approved_at'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('TO_CHAR(qr.approved_at, \'YYYY-MM-DD\') ILIKE $2'),
        expect.arrayContaining([1, '%2024-01-16%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should handle unknown search field gracefully', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: 'test',
        searchField: 'unknown_field'
      });

      // Should not add any search condition for unknown field
      expect(query).toHaveBeenCalledWith(
        expect.not.stringContaining('unknown_field'),
        expect.arrayContaining([1])
      );
      expect(result).toEqual(mockRows);
    });

    it('should trim search term', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: '  test search  ',
        searchField: 'all'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.id::text ILIKE $2 OR'),
        expect.arrayContaining([1, '%test search%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should not add search condition when search is empty', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: '',
        searchField: 'all'
      });

      expect(query).toHaveBeenCalledWith(
        expect.not.stringContaining('ILIKE'),
        expect.arrayContaining([1])
      );
      expect(result).toEqual(mockRows);
    });

    it('should not add search condition when search is only whitespace', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByUserId(1, {
        search: '   ',
        searchField: 'all'
      });

      expect(query).toHaveBeenCalledWith(
        expect.not.stringContaining('ILIKE'),
        expect.arrayContaining([1])
      );
      expect(result).toEqual(mockRows);
    });
  });

  describe('findByPods with search', () => {
    const managedPods = ['pod-1', 'pod-2'];

    it('should search by all fields when searchField is "all"', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByPods(managedPods, {
        search: 'test search',
        searchField: 'all'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.id::text ILIKE $2 OR'),
        expect.arrayContaining([managedPods, '%test search%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should search by specific field - requester_email', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByPods(managedPods, {
        search: 'john@example.com',
        searchField: 'requester_email'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('u.email ILIKE $2'),
        expect.arrayContaining([managedPods, '%john@example.com%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should search by specific field - requester_name', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByPods(managedPods, {
        search: 'John Doe',
        searchField: 'requester_name'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('u.name ILIKE $2'),
        expect.arrayContaining([managedPods, '%John Doe%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should search by created_at date field', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByPods(managedPods, {
        search: '2024-01-15',
        searchField: 'created_at'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('TO_CHAR(qr.created_at, \'YYYY-MM-DD\') ILIKE $2'),
        expect.arrayContaining([managedPods, '%2024-01-15%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should search by approved_at date field', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByPods(managedPods, {
        search: '2024-01-16',
        searchField: 'approved_at'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('TO_CHAR(qr.approved_at, \'YYYY-MM-DD\') ILIKE $2'),
        expect.arrayContaining([managedPods, '%2024-01-16%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should handle search with status filter', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByPods(managedPods, {
        status: 'PENDING',
        search: 'test',
        searchField: 'all'
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('qr.status = $2'),
        expect.arrayContaining([managedPods, 'PENDING', '%test%'])
      );
      expect(result).toEqual(mockRows);
    });

    it('should handle search with pagination', async () => {
      const mockRows = [
        { reqid: 1, query_text: 'SELECT * FROM users', status: 'PENDING' }
      ];
      query.mockResolvedValue({ rows: mockRows });

      const result = await queryRequestRepository.findByPods(managedPods, {
        search: 'test',
        searchField: 'all',
        limit: 10,
        offset: 0
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $3 OFFSET $4'),
        expect.arrayContaining([managedPods, '%test%', 10, 0])
      );
      expect(result).toEqual(mockRows);
    });
  });
});