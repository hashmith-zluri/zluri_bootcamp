import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState, useRef, useEffect } from 'react';

export default function CodeEditor({ 
  code, 
  language = 'javascript', 
  readOnly = false, 
  onChange = null,
  placeholder = '',
  className = '',
  showLineNumbers = false,
  maxHeight = '400px',
  minHeight = '200px'
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);

  // Check if content is scrollable
  useEffect(() => {
    const checkScrollable = () => {
      if (containerRef.current) {
        const { scrollHeight, clientHeight } = containerRef.current;
        setShowScrollIndicator(scrollHeight > clientHeight);
      }
    };

    checkScrollable();
    window.addEventListener('resize', checkScrollable);
    return () => window.removeEventListener('resize', checkScrollable);
  }, [code]);

  if (readOnly) {
    // Read-only syntax highlighted display
    return (
      <div className={`relative rounded-lg overflow-hidden border border-gray-300 ${className}`} style={{ maxHeight }}>
        <div 
          ref={containerRef}
          className="overflow-auto" 
          style={{ maxHeight }}
        >
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            showLineNumbers={showLineNumbers}
            lineNumberStyle={{
              minWidth: '3em',
              paddingRight: '1em',
              color: '#6B7280',
              backgroundColor: '#374151',
              borderRight: '1px solid #4B5563',
              textAlign: 'right',
              userSelect: 'none'
            }}
            customStyle={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.5',
              backgroundColor: '#1F2937',
              padding: '16px',
              minHeight: minHeight
            }}
            codeTagProps={{
              style: {
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
              }
            }}
          >
            {code || ''}
          </SyntaxHighlighter>
        </div>
        
        {/* Scroll indicator for read-only */}
        {showScrollIndicator && (
          <div className="absolute bottom-2 right-2 bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs opacity-75">
            Scroll to see more
          </div>
        )}
      </div>
    );
  }

  // Editable mode - use a simpler approach with just a styled textarea
  return (
    <div className={`relative ${className}`} style={{ maxHeight }}>
      <div 
        ref={containerRef}
        className="overflow-auto" 
        style={{ maxHeight }}
      >
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChange && onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={`w-full bg-gray-900 text-gray-100 border border-gray-600 rounded-lg p-4 font-mono text-sm leading-6 resize-none outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            showLineNumbers ? 'pl-16' : 'pl-4'
          }`}
          style={{
            minHeight: minHeight,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            fontSize: '14px',
            lineHeight: '1.5',
            tabSize: 2
          }}
          spellCheck={false}
          onKeyDown={(e) => {
            // Handle tab key for indentation
            if (e.key === 'Tab') {
              e.preventDefault();
              const start = e.target.selectionStart;
              const end = e.target.selectionEnd;
              const newValue = code.substring(0, start) + '  ' + code.substring(end);
              onChange && onChange(newValue);
              
              // Set cursor position after the inserted spaces
              setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd = start + 2;
              }, 0);
            }
          }}
        />
        
        {/* Line numbers overlay */}
        {showLineNumbers && (
          <div className="absolute left-0 top-0 w-12 bg-gray-800 border-r border-gray-600 rounded-l-lg pointer-events-none overflow-hidden">
            <div className="p-4 text-gray-400 text-sm font-mono leading-6 text-right">
              {code.split('\n').map((_, index) => (
                <div key={`line-${index}`} style={{ height: '24px' }}>
                  {index + 1}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Scroll indicator for editable */}
      {showScrollIndicator && !isFocused && (
        <div className="absolute bottom-2 right-2 bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs opacity-75 pointer-events-none">
          Scroll to see more
        </div>
      )}
    </div>
  );
}