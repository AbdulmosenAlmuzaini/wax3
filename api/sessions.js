import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // حماية نقطة النهاية (Endpoint) للمشرف
  const authHeader = req.headers.authorization;
  const adminPass = process.env.ADMIN_PASSWORD || '123456';
  
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: 'Database URL is not set in environment variables' });
  }

  const sql = neon(dbUrl);

  if (req.method === 'POST') {
    const data = req.body;
    try {
      // إنشاء الجدول إذا لم يكن موجوداً
      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(255) PRIMARY KEY,
          student_name VARCHAR(255),
          user_type VARCHAR(50),
          scenario_id VARCHAR(50),
          start_level VARCHAR(50),
          next_level VARCHAR(50),
          evac_time_sec NUMERIC,
          errors INTEGER,
          exit_used VARCHAR(50),
          reached_assembly BOOLEAN,
          help_used BOOLEAN,
          stops_count INTEGER,
          stops JSONB,
          error_log JSONB,
          result VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        );
      `;

      await sql`
        INSERT INTO sessions (
          id, student_name, user_type, scenario_id, start_level, next_level, 
          evac_time_sec, errors, exit_used, reached_assembly, help_used, 
          stops_count, stops, error_log, result, created_at
        ) VALUES (
          ${data.sessionId}, ${data.studentName}, ${data.userType}, ${data.scenarioId}, ${data.startLevel}, ${data.nextLevel},
          ${data.evacTimeSec || 0}, ${data.errors || 0}, ${data.exitUsed || null}, ${data.reachedAssembly ? true : false}, ${data.helpUsed ? true : false},
          ${data.stopsCount || 0}, ${JSON.stringify(data.stops || [])}, ${JSON.stringify(data.errorLog || [])}, ${data.result || ''}, ${data.createdAt || new Date().toISOString()}
        ) ON CONFLICT (id) DO NOTHING;
      `;
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'GET') {
    if (authHeader !== `Bearer ${adminPass}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const rows = await sql`SELECT * FROM sessions ORDER BY created_at DESC`;
      const sessions = rows.map(r => ({
        sessionId: r.id,
        studentName: r.student_name,
        userType: r.user_type,
        scenarioId: r.scenario_id,
        startLevel: r.start_level,
        nextLevel: r.next_level,
        evacTimeSec: r.evac_time_sec,
        errors: r.errors,
        exitUsed: r.exit_used,
        reachedAssembly: r.reached_assembly,
        helpUsed: r.help_used,
        stopsCount: r.stops_count,
        stops: r.stops,
        errorLog: r.error_log,
        result: r.result,
        createdAt: r.created_at
      }));
      return res.status(200).json(sessions);
    } catch (e) {
      if (e.message.includes('relation "sessions" does not exist')) {
        return res.status(200).json([]);
      }
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
