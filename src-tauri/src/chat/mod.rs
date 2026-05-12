//! Chat module — V2.0.1 conversational interface.
//!
//! Layered submodules:
//! - `session`   — chat_sessions CRUD
//! - `message`   — chat_messages CRUD
//! - `attachment` — chat_attachments + file extraction
//! - `context`   — assemble Vec<ApiMessage> for an LLM call (skill / history / attachments)
//! - `streaming` — `send_chat_message` orchestrates: persist user msg →
//!   build context → stream tokens → persist assistant msg

pub mod attachment;
pub mod context;
pub mod message;
pub mod session;
pub mod streaming;

pub use attachment::*;
pub use message::*;
pub use session::*;
pub use streaming::*;
