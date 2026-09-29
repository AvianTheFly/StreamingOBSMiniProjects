"""Default short effects; personalized overrides live in external settings."""
from lib.paths import PROJECT_ROOT

PORT = 7442
SOURCE = "Hub Viewer Stickers"
SCOPE = "channel:manage:redemptions"
EVENT = "channel.channel_points_custom_reward_redemption.add"
ASSETS = PROJECT_ROOT / "hub_ui" / "viewer_assets"
PAGE = PROJECT_ROOT / "hub_ui" / "viewer_rewards.html"
EFFECTS = {
    "bear": dict(title="Tiny Bot Lane Bear", cost=10, duration=1000, image="botlaneBear-chat.png", label="", color="#d97706"),
    "oops": dict(title="Tiny Udyr Oops", cost=10, duration=1000, image="botlaneOops-chat.png", label="OOPS", color="#0891b2"),
    "cannon": dict(title="Cannon Incident", cost=15, duration=1000, image="botlaneOops-chat.png", label="CANNON?", color="#2563eb"),
    "calculated": dict(title="Totally Calculated", cost=15, duration=1000, image="botlaneBear-chat.png", label="CALCULATED", color="#7c3aed"),
    "fear": dict(title="No Fear Bot Lane", cost=25, duration=1500, image="botlaneBear-chat.png", label="NO FEAR", color="#db2777"),
    "party": dict(title="Bear Victory Dance", cost=50, duration=2000, image="botlaneBear-chat.png", label="BOT LANE DIFF", color="#d97706"),
}
