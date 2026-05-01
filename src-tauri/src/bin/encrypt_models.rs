use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use pbkdf2::pbkdf2;
use hmac::Hmac;
use sha2::Sha256;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Templates {
    pub delta_plane_setup: String,
    pub session_info_base: String,
    pub signatures_base: String,
    pub section: String,
    pub list: String,
    pub subtitle: String,
}

fn main() {
    dotenvy::dotenv().ok();
    
    let password = std::env::var("unlock_mdp").expect("unlock_mdp must be set in .env");
    let salt_str = std::env::var("MODEL_SALT").expect("MODEL_SALT must be set in .env");
    let salt = salt_str.as_bytes();
    let nonce_str = std::env::var("MODEL_NONCE").expect("MODEL_NONCE must be set in .env");
    let nonce_bytes = nonce_str.as_bytes();
    
    let mut key = [0u8; 32];
    pbkdf2::<Hmac<Sha256>>(password.as_bytes(), salt, 100_000, &mut key).expect("PBKDF2 failed");
    
    // Read templates from environment variable
    let templates_json = std::env::var("TEMPLATES_JSON").expect("TEMPLATES_JSON must be set in .env");
    let templates: Templates = serde_json::from_str(&templates_json).expect("Failed to parse templates from .env");
    
    let json = serde_json::to_string(&templates).unwrap();
    let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
    let mut nonce = aes_gcm::aead::generic_array::GenericArray::<u8, aes_gcm::aead::consts::U12>::default();
    nonce.copy_from_slice(nonce_bytes);
    
    let ciphertext = cipher.encrypt(&nonce, json.as_bytes()).expect("Encryption failed");
    
    print!("const ENCRYPTED_DATA: &[u8] = &[");
    for (i, byte) in ciphertext.iter().enumerate() {
        if i > 0 { print!(", "); }
        print!("{}", byte);
    }
    println!("];");
}
