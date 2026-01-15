import { useState } from 'react';

export default function OutputDisplay({ output, error }) {
  const [viewMode, setViewMode] = useState('formatted');
  const [expandedSections, setExpandedSections] = useState({
    console: true,
    result: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Try to parse and format JSON
  const formatOutput = (text) => {
    if (!text) return null;

    try {
      const parsed = JSON.parse(text);
      return { type: 'json', data: parsed };
    } catch {
      // Not JSON, return as plain text
      return { type: 'text', data: text };
    }
  };

  const formatted = output ? formatOutput(output) : null;

  // Check if output has structured script execution format
  const isScriptOutput = formatted?.type === 'json' && 
    formatted.data && 
    (formatted.data.console_output || formatted.data.result_data || formatted.data.metadata || formatted.data.queries);

  const renderJSON = (data, indent = 0) => {
    if (data === null) return <span className="text-gray-500">null</span>;
    if (data === undefined) return <span className="text-gray-500">undefined</span>;
    if (typeof data === 'boolean') return <span className="text-purple-600 font-semibold">{String(data)}</span>;
    if (typeof data === 'number') return <span className="text-blue-600 font-semibold">{data}</span>;
    if (typeof data === 'string') return <span className="text-green-600">"{data}"</span>;

    if (Array.isArray(data)) {
      if (data.length === 0) return <span className="text-gray-500">[]</span>;
      
      return (
        <div>
          <span className="text-gray-500">[</span>
          <div className="ml-4">
            {data.map((item, index) => (
              <div key={index}>
                {renderJSON(item, indent + 1)}
                {index < data.length - 1 && <span className="text-gray-500">,</span>}
              </div>
            ))}
          </div>
          <span className="text-gray-500">]</span>
        </div>
      );
    }

    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return <span className="text-gray-500">{'{}'}</span>;

      return (
        <div>
          <span className="text-gray-500">{'{'}</span>
          <div className="ml-4">
            {keys.map((key, index) => (
              <div key={key}>
                <span className="text-red-600 font-semibold">"{key}"</span>
                <span className="text-gray-500">: </span>
                {renderJSON(data[key], indent + 1)}
                {index < keys.length - 1 && <span className="text-gray-500">,</span>}
              </div>
            ))}
          </div>
          <span className="text-gray-500">{'}'}</span>
        </div>
      );
    }

    return <span>{String(data)}</span>;
  };

  const renderTable = (data) => {
    if (!Array.isArray(data) || data.length === 0) return null;
    
    // Check if all items are objects with same keys
    const firstItem = data[0];
    if (typeof firstItem !== 'object' || firstItem === null) return null;
    
    const keys = Object.keys(firstItem);
    const allSameKeys = data.every(item => 
      typeof item === 'object' && 
      item !== null && 
      Object.keys(item).length === keys.length &&
      Object.keys(item).every(k => keys.includes(k))
    );

    if (!allSameKeys) return null;

    return (
      <div className="max-h-80 overflow-auto border border-gray-200 rounded">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {keys.map(key => (
                <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase border-r">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {keys.map(key => (
                  <td key={key} className="px-4 py-2 text-sm text-gray-900 border-r">
                    <div className="max-w-xs overflow-hidden text-ellipsis">
                      {typeof row[key] === 'object' 
                        ? JSON.stringify(row[key]) 
                        : String(row[key] ?? '')}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderScriptOutput = (data) => {
    const { console_output, result_data } = data;

    return (
      <div className="space-y-4">
        {/* Console Output Section */}
        {console_output && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('console')}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-semibold text-gray-900">Console Output</span>
              </div>
              <span className="text-gray-500">{expandedSections.console ? '▼' : '▶'}</span>
            </button>
            {expandedSections.console && (
              <div className="bg-gray-900 text-gray-100 max-h-80 overflow-auto">
                <pre className="p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                  {console_output}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Result Data Section (for query results) */}
        {result_data && result_data.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('result')}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="font-semibold text-gray-900">Result Data ({result_data.length} rows)</span>
              </div>
              <span className="text-gray-500">{expandedSections.result ? '▼' : '▶'}</span>
            </button>
            {expandedSections.result && (
              <div className="bg-white max-h-80 overflow-auto">
                <div className="p-4">
                  {renderTable(result_data) || (
                    <pre className="text-sm font-mono">
                      {JSON.stringify(result_data, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-700 font-medium">Error</span>
        </div>
        <div className="bg-white border border-red-200 rounded max-h-60 overflow-auto">
          <pre className="p-3 text-sm text-red-600 whitespace-pre-wrap">
            {error}
          </pre>
        </div>
      </div>
    );
  }

  if (!output) {
    return (
      <div className="text-gray-500 text-sm italic">
        No output available
      </div>
    );
  }

  const canShowTable = formatted?.type === 'json' && Array.isArray(formatted.data);

  return (
    <div>
      {/* View Mode Toggle */}
      {formatted?.type === 'json' && !isScriptOutput && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setViewMode('formatted')}
            className={`px-3 py-1 text-xs rounded ${
              viewMode === 'formatted'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Formatted
          </button>
          {canShowTable && (
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs rounded ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Table
            </button>
          )}
          <button
            onClick={() => setViewMode('raw')}
            className={`px-3 py-1 text-xs rounded ${
              viewMode === 'raw'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Raw
          </button>
        </div>
      )}

      {/* Output Display */}
      <div className={isScriptOutput ? '' : 'bg-white border rounded-lg overflow-hidden'}>
        <div className={isScriptOutput ? '' : 'p-4 max-h-96 overflow-auto'}>
          {isScriptOutput ? (
            renderScriptOutput(formatted.data)
          ) : viewMode === 'table' && canShowTable ? (
            renderTable(formatted.data)
          ) : viewMode === 'formatted' && formatted?.type === 'json' ? (
            <div className="font-mono text-sm">
              {renderJSON(formatted.data)}
            </div>
          ) : (
            <pre className="font-mono text-sm whitespace-pre-wrap text-gray-800">
              {formatted?.type === 'json' 
                ? JSON.stringify(formatted.data, null, 2)
                : output}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
