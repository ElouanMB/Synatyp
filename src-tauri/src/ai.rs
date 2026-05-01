use std::sync::Mutex;

#[derive(Default)]
pub struct AiState {
    pub api_key: Mutex<Option<String>>,
}

impl AiState {
    pub fn set_key(&self, key: String) {
        let mut lock = self.api_key.lock().unwrap();
        *lock = Some(key);
    }

    pub fn get_key(&self) -> Option<String> {
        let lock = self.api_key.lock().unwrap();
        lock.clone()
    }
}
