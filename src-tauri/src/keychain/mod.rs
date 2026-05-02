//! Thin wrapper around `keyring` crate.
//!
//! - Service: `"sghub"`
//! - Username: model_id (UUID string)
//!
//! Backend per OS:
//! - Windows: Credential Manager (Generic Credential)
//! - macOS: Keychain
//! - Linux: Secret Service (gnome-keyring / kwallet via libsecret)

use thiserror::Error;

const SERVICE: &str = "sghub";

#[derive(Debug, Error)]
pub enum KeychainError {
    #[error("keyring error: {0}")]
    Keyring(#[from] keyring::Error),
}

pub fn set_api_key(model_id: &str, key: &str) -> Result<(), KeychainError> {
    let entry = keyring::Entry::new(SERVICE, model_id)?;
    entry.set_password(key)?;
    Ok(())
}

/// Returns `Ok(None)` when no entry exists for `model_id`.
pub fn get_api_key(model_id: &str) -> Result<Option<String>, KeychainError> {
    let entry = keyring::Entry::new(SERVICE, model_id)?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(KeychainError::Keyring(e)),
    }
}

/// Idempotent — succeeds whether the entry existed or not.
pub fn delete_api_key(model_id: &str) -> Result<(), KeychainError> {
    let entry = keyring::Entry::new(SERVICE, model_id)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(KeychainError::Keyring(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Round-trip via the real OS backend.
    /// Marked `#[ignore]` because CI runners (especially headless Linux)
    /// don't have an active secret-service session.
    /// Run locally with: `cargo test --lib keychain -- --ignored`
    #[test]
    #[ignore]
    fn set_get_delete_round_trip() {
        let id = format!("test-{}", uuid::Uuid::now_v7());
        let secret = "sk-test-12345";

        set_api_key(&id, secret).expect("set");
        let got = get_api_key(&id).expect("get");
        assert_eq!(got.as_deref(), Some(secret));

        delete_api_key(&id).expect("delete");
        let after = get_api_key(&id).expect("get after delete");
        assert!(after.is_none());

        // delete again — must be idempotent
        delete_api_key(&id).expect("delete idempotent");
    }

    #[test]
    fn get_nonexistent_returns_none() {
        // skip on Linux without a session — manifests as "Platform secret service not available"
        let id = format!("test-nonexistent-{}", uuid::Uuid::now_v7());
        match get_api_key(&id) {
            Ok(None) => {}
            Ok(Some(_)) => panic!("unexpectedly found a value"),
            Err(_) => {
                // backend unavailable (headless CI etc.) — skip
                eprintln!("keychain backend unavailable, skipping");
            }
        }
    }
}
