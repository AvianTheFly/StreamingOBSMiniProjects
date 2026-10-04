"""Cheap matching of the user's static between-games background."""
from pathlib import Path


class BetweenGamesMatcher:
    def __init__(self, cv):
        self.cv = cv
        reference = cv.imread(str(Path(__file__).parent/'references/between-games-table.png'),
                              cv.IMREAD_GRAYSCALE)
        self.templates = []
        if reference is not None:
            # Bottom captions can cover the dragon/skull while mugs, candles and
            # crystal remain visible. Match that stable upper portion instead.
            reference = reference[:round(reference.shape[0]*.72)]
            for width in range(48, 385, 6):
                self.templates.append(cv.resize(reference, (width, round(width*reference.shape[0]/reference.shape[1])),
                                                interpolation=cv.INTER_AREA))

    def matches(self, image):
        cv = self.cv
        h, w = image.shape[:2]
        area = cv.cvtColor(cv.resize(image, (480, round(h*480/w)),
                                    interpolation=cv.INTER_AREA), cv.COLOR_BGR2GRAY)
        for template in self.templates:
            if template.shape[0] <= area.shape[0] and template.shape[1] <= area.shape[1]:
                if cv.minMaxLoc(cv.matchTemplate(area, template, cv.TM_CCOEFF_NORMED))[1] >= .82:
                    return True
        return False
