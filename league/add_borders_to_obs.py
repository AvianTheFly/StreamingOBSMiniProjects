from pathlib import Path
import sys
import os

try:
    import obsws_python as obs
except ImportError:
    print("Missing dependency: obsws-python")
    print("Install with: pip install obsws-python")
    sys.exit(1)

OBS_HOST = os.environ.get("OBS_HOST", "localhost")
OBS_PORT = int(os.environ.get("OBS_PORT", "4455"))
OBS_PASSWORD = os.environ.get("OBS_PASSWORD", "")

SCENE_NAME = "LeagueGameAssets"
BORDERS_DIR = Path(r"F:\EVERYTHING STREAM RELATED\Assets\Borders")


def source_exists(cl, source_name: str) -> bool:
    try:
        cl.get_input_settings(source_name)
        return True
    except Exception:
        return False


def scene_exists(cl, scene_name: str) -> bool:
    scenes = cl.get_scene_list()
    return any(scene["sceneName"] == scene_name for scene in scenes.scenes)


def main():
    if not BORDERS_DIR.exists():
        print(f"Folder not found: {BORDERS_DIR}")
        return

    png_files = sorted(BORDERS_DIR.glob("*.png"))
    if not png_files:
        print(f"No PNG files found in: {BORDERS_DIR}")
        return

    if not OBS_PASSWORD:
        print("OBS_PASSWORD not set — create a .env file from .env.example")
        return

    cl = obs.ReqClient(host=OBS_HOST, port=OBS_PORT, password=OBS_PASSWORD)

    if not scene_exists(cl, SCENE_NAME):
        print(f"Scene not found in OBS: {SCENE_NAME}")
        return

    for png in png_files:
        source_name = png.stem

        if source_exists(cl, source_name):
            print(f"Skipping existing source: {source_name}")
            continue

        settings = {"file": str(png)}

        try:
            cl.create_input(
                sceneName=SCENE_NAME,
                inputName=source_name,
                inputKind="image_source",
                inputSettings=settings,
                sceneItemEnabled=False,
            )
            print(f"Added: {source_name} -> {png}")
        except Exception as e:
            print(f"Failed to add {source_name}: {e}")


if __name__ == "__main__":
    main()
