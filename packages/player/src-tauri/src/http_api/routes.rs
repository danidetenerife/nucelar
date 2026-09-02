use std::convert::Infallible;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use futures::Stream;
use serde_json::{json, Value};

use super::actions;
use super::search;
use super::RemoteEvent;
use crate::bridge::bridge::Bridge;
use crate::bridge::types::BridgeError;
use tokio::sync::broadcast;

#[derive(Clone)]
pub struct AppState {
    pub bridge: Bridge,
    pub events_tx: broadcast::Sender<RemoteEvent>,
}

pub struct BridgeErrorResponse(pub BridgeError);

impl IntoResponse for BridgeErrorResponse {
    fn into_response(self) -> axum::response::Response {
        (StatusCode::INTERNAL_SERVER_ERROR, self.0.to_string()).into_response()
    }
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

async fn get_queue(State(state): State<AppState>) -> Result<Json<Value>, BridgeErrorResponse> {
    state
        .bridge
        .call("Queue.getQueue", json!({}))
        .await
        .map(Json)
        .map_err(BridgeErrorResponse)
}

async fn get_playback(State(state): State<AppState>) -> Result<Json<Value>, BridgeErrorResponse> {
    state
        .bridge
        .call("Playback.getStatus", json!({}))
        .await
        .map(Json)
        .map_err(BridgeErrorResponse)
}

async fn get_favorites(State(state): State<AppState>) -> Result<Json<Value>, BridgeErrorResponse> {
    let bridge = &state.bridge;
    let (tracks, albums, artists) = tokio::try_join!(
        bridge.call("Favorites.getTracks", json!({})),
        bridge.call("Favorites.getAlbums", json!({})),
        bridge.call("Favorites.getArtists", json!({})),
    )
    .map_err(BridgeErrorResponse)?;

    Ok(Json(json!({
        "tracks": tracks,
        "albums": albums,
        "artists": artists,
    })))
}

async fn get_settings(State(state): State<AppState>) -> Result<Json<Value>, BridgeErrorResponse> {
    let bridge = &state.bridge;
    let (shuffle, repeat, discovery, language, dark, theme_id) = tokio::try_join!(
        bridge.call("Settings.getGlobal", json!({"id": "core.playback.shuffle"})),
        bridge.call("Settings.getGlobal", json!({"id": "core.playback.repeat"})),
        bridge.call("Settings.getGlobal", json!({"id": "core.playback.discovery"})),
        bridge.call("Settings.getGlobal", json!({"id": "core.general.language"})),
        bridge.call("Settings.getGlobal", json!({"id": "core.theme.dark"})),
        bridge.call("Settings.getGlobal", json!({"id": "core.theme.active.id"})),
    )
    .map_err(BridgeErrorResponse)?;

    Ok(Json(json!({
        "shuffle": shuffle,
        "repeat": repeat,
        "discovery": discovery,
        "language": language,
        "dark": dark,
        "themeId": theme_id,
    })))
}

async fn get_playlists(State(state): State<AppState>) -> Result<Json<Value>, BridgeErrorResponse> {
    let bridge = &state.bridge;

    let index = bridge
        .call("Playlists.getIndex", json!({}))
        .await
        .map_err(BridgeErrorResponse)?;

    let entries = match index.as_array() {
        Some(arr) => arr.clone(),
        None => vec![],
    };

    let mut full_playlists: Vec<Value> = Vec::new();
    for entry in &entries {
        if let Some(id) = entry.get("id").and_then(|v| v.as_str()) {
            match bridge
                .call("Playlists.getPlaylist", json!({"id": id}))
                .await
            {
                Ok(playlist) => {
                    if !playlist.is_null() {
                        full_playlists.push(playlist);
                    }
                }
                Err(err) => {
                    log::warn!("Failed to get playlist {}: {}", id, err);
                }
            }
        }
    }

    Ok(Json(json!(full_playlists)))
}

async fn get_sync(State(state): State<AppState>) -> Result<Json<Value>, BridgeErrorResponse> {
    let bridge = &state.bridge;
    let (tracks, albums, artists, shuffle, repeat, discovery, language, dark, theme_id, queue) = tokio::try_join!(
        bridge.call("Favorites.getTracks", json!({})),
        bridge.call("Favorites.getAlbums", json!({})),
        bridge.call("Favorites.getArtists", json!({})),
        bridge.call("Settings.getGlobal", json!({"id": "core.playback.shuffle"})),
        bridge.call("Settings.getGlobal", json!({"id": "core.playback.repeat"})),
        bridge.call("Settings.getGlobal", json!({"id": "core.playback.discovery"})),
        bridge.call("Settings.getGlobal", json!({"id": "core.general.language"})),
        bridge.call("Settings.getGlobal", json!({"id": "core.theme.dark"})),
        bridge.call("Settings.getGlobal", json!({"id": "core.theme.active.id"})),
        bridge.call("Queue.getQueue", json!({})),
    )
    .map_err(BridgeErrorResponse)?;

    let index = bridge
        .call("Playlists.getIndex", json!({}))
        .await
        .unwrap_or(json!([]));

    let entries = match index.as_array() {
        Some(arr) => arr.clone(),
        None => vec![],
    };

    let mut playlists: Vec<Value> = Vec::new();
    for entry in &entries {
        if let Some(id) = entry.get("id").and_then(|v| v.as_str()) {
            if let Ok(playlist) = bridge
                .call("Playlists.getPlaylist", json!({"id": id}))
                .await
            {
                if !playlist.is_null() {
                    playlists.push(playlist);
                }
            }
        }
    }

    let deleted_keys = bridge
        .call("Favorites.getDeletedKeys", json!({}))
        .await
        .unwrap_or(json!({}));

    Ok(Json(json!({
        "favorites": {
            "tracks": tracks,
            "albums": albums,
            "artists": artists,
            "deletedKeys": deleted_keys,
        },
        "settings": {
            "shuffle": shuffle,
            "repeat": repeat,
            "discovery": discovery,
            "language": language,
            "dark": dark,
            "themeId": theme_id,
        },
        "queue": queue,
        "playlists": playlists,
    })))
}

async fn push_sync(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, BridgeErrorResponse> {
    let bridge = &state.bridge;

    if let Some(favorites) = body.get("favorites") {
        // 1. Apply tombstones from the APK: remove any item whose key is in deletedKeys
        if let Some(deleted_keys) = favorites.get("deletedKeys").and_then(|v| v.as_object()) {
            for key in deleted_keys.keys() {
                let parts: Vec<&str> = key.splitn(2, "::").collect();
                if parts.len() == 2 {
                    let prefix = parts[0];
                    let id = parts[1];
                    if prefix == "artist" {
                        // artist::name tombstone — remove by name
                        let _ = bridge
                            .call(
                                "Favorites.removeArtistByName",
                                json!({ "name": id }),
                            )
                            .await;
                    } else {
                        // provider::id tombstone — remove track or artist by source ref
                        let source = json!({ "provider": prefix, "id": id });
                        let _ = bridge
                            .call("Favorites.removeArtist", json!({ "source": source }))
                            .await;
                        let _ = bridge
                            .call("Favorites.removeTrack", json!({ "source": source }))
                            .await;
                    }
                }
            }
        }

        // 2. Add tracks (skip if already favorited on the PC)
        if let Some(tracks) = favorites.get("tracks") {
            if let Some(arr) = tracks.as_array() {
                for track_entry in arr {
                    if let Some(track_ref) = track_entry.get("ref") {
                        let _ = bridge
                            .call("Favorites.addTrack", json!({"track": track_ref}))
                            .await;
                    }
                }
            }
        }

        // 3. Add artists (skip if already favorited on the PC)
        if let Some(artists) = favorites.get("artists") {
            if let Some(arr) = artists.as_array() {
                for artist_entry in arr {
                    if let Some(artist_ref) = artist_entry.get("ref") {
                        let _ = bridge
                            .call("Favorites.addArtist", json!({"ref": artist_ref}))
                            .await;
                    }
                }
            }
        }
    }

    // 4. Sync settings (skip theme keys — each device keeps its own theme)
    if let Some(settings) = body.get("settings") {
        if let Some(obj) = settings.as_object() {
            for (key, value) in obj {
                let is_theme_key = key.contains("theme") || key == "dark" || key == "themeId";
                if !is_theme_key {
                    let _ = bridge
                        .call("Settings.setGlobal", json!({"id": key, "value": value}))
                        .await;
                }
            }
        }
    }

    // 5. Import playlists from APK
    if let Some(playlists) = body.get("playlists") {
        if let Some(arr) = playlists.as_array() {
            for playlist in arr {
                let _ = bridge
                    .call("Playlists.importPlaylist", json!({"playlist": playlist}))
                    .await;
            }
        }
    }

    // 6. Return PC's current deletedKeys so the APK merges them
    let pc_deleted_keys = match bridge.call("Favorites.getDeletedKeys", json!({})).await {
        Ok(keys) => keys,
        Err(_) => json!({}),
    };

    Ok(Json(json!({ "deletedKeys": pc_deleted_keys })))
}

async fn get_setting(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, BridgeErrorResponse> {
    state
        .bridge
        .call("Settings.getGlobal", json!({"id": id}))
        .await
        .map(Json)
        .map_err(BridgeErrorResponse)
}

async fn set_setting(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> Result<StatusCode, BridgeErrorResponse> {
    state
        .bridge
        .call("Settings.setGlobal", json!({"id": id, "value": body}))
        .await
        .map(|_| StatusCode::OK)
        .map_err(BridgeErrorResponse)
}

fn events_stream(
    mut receiver: broadcast::Receiver<RemoteEvent>,
) -> impl Stream<Item = Result<Event, Infallible>> {
    async_stream::stream! {
        yield Ok(Event::default().comment("connected"));

        loop {
            match receiver.recv().await {
                Ok(remote_event) => {
                    let event = Event::default()
                        .event(remote_event.kind.as_str())
                        .data(remote_event.data);
                    yield Ok(event);
                }
                Err(broadcast::error::RecvError::Lagged(count)) => {
                    log::warn!("SSE client lagged, skipped {count} events");
                    continue;
                }
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    }
}

async fn get_events(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let receiver = state.events_tx.subscribe();
    Sse::new(events_stream(receiver)).keep_alive(KeepAlive::default())
}

pub fn router(bridge: Bridge, events_tx: broadcast::Sender<RemoteEvent>) -> Router {
    let state = AppState { bridge, events_tx };

    Router::new()
        .route("/api/health", get(health))
        .route("/api/sync", get(get_sync))
        .route("/api/sync/push", post(push_sync))
        .route("/api/favorites", get(get_favorites))
        .route("/api/playlists", get(get_playlists))
        .route("/api/queue", get(get_queue))
        .route("/api/playback", get(get_playback))
        .route("/api/settings", get(get_settings))
        .route("/api/settings/{id}", get(get_setting).post(set_setting))
        .route("/api/events", get(get_events))
        .route("/api/playback/play", post(actions::play))
        .route("/api/playback/toggle", post(actions::toggle_playback))
        .route("/api/playback/next", post(actions::next_track))
        .route("/api/playback/previous", post(actions::previous_track))
        .route("/api/playback/seek", post(actions::seek))
        .route("/api/playback/shuffle", post(actions::set_shuffle))
        .route("/api/playback/repeat", post(actions::set_repeat))
        .route("/api/queue/add", post(actions::add_to_queue))
        .route("/api/queue/remove", post(actions::remove_from_queue))
        .route("/api/search", post(search::search))
        .fallback(super::frontend::serve_frontend)
        .with_state(state)
}
