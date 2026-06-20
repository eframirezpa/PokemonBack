const fs   = require('fs')
const path = require('path')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const BUCKET       = 'partida-sprites'

// Sube un buffer a Supabase Storage (prod) o al disco local (dev)
// Devuelve la URL/path pública que se guarda en la BD
const uploadSprite = async (buffer, remotePath, mimetype = 'image/jpeg') => {
  if (SUPABASE_URL && SUPABASE_KEY) {
    const { createClient } = require('@supabase/supabase-js')
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(remotePath, buffer, { contentType: mimetype, upsert: true })

    if (error) throw new Error(`Supabase Storage: ${error.message}`)

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(remotePath)
    return data.publicUrl
  }

  // Fallback local
  const localPath = path.join(__dirname, '../../public', remotePath)
  fs.mkdirSync(path.dirname(localPath), { recursive: true })
  fs.writeFileSync(localPath, buffer)
  return `/${remotePath}`
}

module.exports = { uploadSprite }
