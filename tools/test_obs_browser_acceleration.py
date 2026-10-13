"""Exercise the finite settings adapter without a live OBS process or profile."""
import unittest
from tools.set_obs_browser_acceleration import patch_acceleration


class BrowserAccelerationSettingsTests(unittest.TestCase):
    def test_exact_edit_preserves_bom_newlines_unknown_fields_and_other_sections(self):
        before=b'\xef\xbb\xbf[General]\r\nBrowserHWAccel=false\r\nUnknown=value\r\n[Video]\r\nFPS=60\r\n'
        expected=before.replace(b'BrowserHWAccel=false',b'BrowserHWAccel=true')
        self.assertEqual(patch_acceleration(before,True),expected)
        self.assertEqual(patch_acceleration(expected,False),before)
        self.assertEqual(patch_acceleration(expected,True),expected)

    def test_absent_ambiguous_or_unrecognized_values_are_preserved_by_rejection(self):
        for before in [b'[General]\n',b'BrowserHWAccel=maybe\n',b'BrowserHWAccel=false\nBrowserHWAccel=true\n']:
            with self.assertRaises(ValueError):patch_acceleration(before,True)
