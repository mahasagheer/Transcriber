import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    console.error('ASSEMBLYAI_API_KEY is missing');
    return res.status(500).json({ error: 'ASSEMBLYAI_API_KEY is missing' });
  }
  try {
    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: { authorization: apiKey },
    });
    const data = await response.json();
    if (!data.token) {
      console.error('Failed to get token from AssemblyAI:', data);
      return res.status(500).json({ error: 'Failed to get token from AssemblyAI', details: data });
    }
    res.status(200).json({ token: data.token });
  } catch (err) {
    console.error('Error fetching token from AssemblyAI:', err);
    res.status(500).json({ error: 'Error fetching token from AssemblyAI' });
  }
}