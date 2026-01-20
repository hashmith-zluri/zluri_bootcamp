import { 
  getStatusColor, 
  getStatusIcon, 
  formatFileSize, 
  truncateText, 
  isValidEmail, 
  formatDuration 
} from '../../src/utils/conditionalHelpers';

describe('ConditionalHelpers - Additional Coverage', () => {
  describe('getStatusColor', () => {
    it('should return correct colors for all status types', () => {
      expect(getStatusColor('PENDING')).toBe('yellow');
      expect(getStatusColor('APPROVED')).toBe('blue');
      expect(getStatusColor('REJECTED')).toBe('red');
      expect(getStatusColor('EXECUTED')).toBe('green');
      expect(getStatusColor('FAILED')).toBe('red');
      expect(getStatusColor('EXECUTING')).toBe('blue');
    });

    it('should return default color for unknown status', () => {
      expect(getStatusColor('UNKNOWN')).toBe('gray');
      expect(getStatusColor('')).toBe('gray');
      expect(getStatusColor(null)).toBe('gray');
      expect(getStatusColor(undefined)).toBe('gray');
    });
  });

  describe('getStatusIcon', () => {
    it('should return correct icons for all status types', () => {
      expect(getStatusIcon('PENDING')).toBe('⏳');
      expect(getStatusIcon('APPROVED')).toBe('✅');
      expect(getStatusIcon('REJECTED')).toBe('❌');
      expect(getStatusIcon('EXECUTED')).toBe('🎉');
      expect(getStatusIcon('FAILED')).toBe('💥');
      expect(getStatusIcon('EXECUTING')).toBe('⚡');
    });

    it('should return default icon for unknown status', () => {
      expect(getStatusIcon('UNKNOWN')).toBe('❓');
      expect(getStatusIcon('')).toBe('❓');
      expect(getStatusIcon(null)).toBe('❓');
      expect(getStatusIcon(undefined)).toBe('❓');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(512)).toBe('512 B');
      expect(formatFileSize(1023)).toBe('1023 B');
    });

    it('should format KB correctly', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1024 * 1023)).toBe('1023.0 KB');
    });

    it('should format MB correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5 MB');
      expect(formatFileSize(1024 * 1024 * 1023)).toBe('1023.0 MB');
    });

    it('should format GB correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
      expect(formatFileSize(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB');
    });

    it('should handle edge cases', () => {
      expect(formatFileSize(-1)).toBe('0 B');
      expect(formatFileSize(null)).toBe('0 B');
      expect(formatFileSize(undefined)).toBe('0 B');
      expect(formatFileSize('invalid')).toBe('0 B');
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const longText = 'This is a very long text that should be truncated';
      expect(truncateText(longText, 20)).toBe('This is a very long...');
    });

    it('should not truncate short text', () => {
      const shortText = 'Short text';
      expect(truncateText(shortText, 20)).toBe('Short text');
    });

    it('should handle exact length', () => {
      const text = 'Exactly twenty chars';
      expect(truncateText(text, 20)).toBe('Exactly twenty chars');
    });

    it('should handle edge cases', () => {
      expect(truncateText('', 10)).toBe('');
      expect(truncateText(null, 10)).toBe('');
      expect(truncateText(undefined, 10)).toBe('');
      expect(truncateText('test', 0)).toBe('...');
      expect(truncateText('test', -1)).toBe('...');
    });

    it('should use custom suffix', () => {
      const longText = 'This is a long text';
      expect(truncateText(longText, 10, ' [more]')).toBe('This is a [more]');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
      expect(isValidEmail('123@example.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test..test@example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds correctly', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds correctly', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(59999)).toBe('60.0s');
    });

    it('should format minutes correctly', () => {
      expect(formatDuration(60000)).toBe('1.0m');
      expect(formatDuration(90000)).toBe('1.5m');
      expect(formatDuration(3599000)).toBe('60.0m');
    });

    it('should format hours correctly', () => {
      expect(formatDuration(3600000)).toBe('1.0h');
      expect(formatDuration(5400000)).toBe('1.5h');
    });

    it('should handle edge cases', () => {
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(-1)).toBe('0ms');
      expect(formatDuration(null)).toBe('0ms');
      expect(formatDuration(undefined)).toBe('0ms');
      expect(formatDuration('invalid')).toBe('0ms');
    });
  });
});