UPDATE visual_template_definitions
SET
  entry_url = CASE template_key
    WHEN 'p01' THEN 'http://localhost:5181/#modules/P-01'
    WHEN 'p02' THEN 'http://localhost:5181/#modules/P-02'
    WHEN 'p05' THEN 'http://localhost:5181/#modules/P-05'
    WHEN 'p12' THEN 'http://localhost:5181/#modules/P-12'
    WHEN 'p14' THEN 'http://localhost:5181/#modules/P-14'
    ELSE entry_url
  END,
  updated_at = NOW()
WHERE template_key IN ('p01', 'p02', 'p05', 'p12', 'p14');
