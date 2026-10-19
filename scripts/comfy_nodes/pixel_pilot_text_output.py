class PixelPilotTextOutput:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"text": ("STRING", {"forceInput": True})}}

    RETURN_TYPES = ()
    FUNCTION = "save_text"
    OUTPUT_NODE = True
    CATEGORY = "Pixel Pilot"

    def save_text(self, text):
        return {"ui": {"text": [str(text)]}, "result": ()}


NODE_CLASS_MAPPINGS = {"PixelPilotTextOutput": PixelPilotTextOutput}
NODE_DISPLAY_NAME_MAPPINGS = {"PixelPilotTextOutput": "Pixel Pilot Text Output"}
