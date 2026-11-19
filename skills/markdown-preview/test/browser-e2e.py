"""Optional real-browser smoke test: python test/browser-e2e.py (Playwright + Chromium)."""
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

from playwright.sync_api import expect, sync_playwright

SKILL = Path(__file__).resolve().parents[1]


def run(*args):
        cmd = ["node", str(SKILL / "scripts/preview.mjs"), *map(str, args)]
        return json.loads(subprocess.check_output(cmd, text=True))


def check(browser, root):
        notes = root / "notes"
        shutil.copytree(SKILL / "examples/study-notes", notes)
        store = root / "review"
        args = (notes, "--annotations-dir", store)
        processes = []
        errors = []
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
                def start():
                        proc = subprocess.Popen(
                                ["node", str(SKILL / "scripts/preview.mjs"), *map(str, args), "--port", "0"],
                                stdout=subprocess.PIPE, text=True,
                        )
                        processes.append(proc)
                        return proc, json.loads(proc.stdout.readline())["url"]

                server, url = start()
                page.goto(url)
                outline = page.locator("#toc-sidebar")
                rail = page.locator("#workspace-rail")
                paper = page.locator(".paper")
                assert outline.bounding_box()["x"] < paper.bounding_box()["x"] < rail.bounding_box()["x"]
                documents = outline.locator("#documents-list")
                picker = page.locator("#doc-picker-trigger")
                pager = page.get_by_role("navigation", name="顺序阅读")
                expect(page.locator("#page-indicator")).to_have_text("1/3")
                expect(paper.get_by_role("navigation", name="继续阅读")).to_have_count(0)
                expect(pager.get_by_role("link", name="上一篇")).to_have_attribute("aria-disabled", "true")
                pager.get_by_role("link", name="下一篇").click()
                expect(page.locator("#page-indicator")).to_have_text("2/3")
                pager.get_by_role("link", name="上一篇").click()
                expect(page.locator("#page-indicator")).to_have_text("1/3")
                more = page.get_by_role("button", name="更多操作")
                more.click()
                expect(page.get_by_role("button", name="打印 / PDF")).to_be_focused()
                page.keyboard.press("Escape")
                expect(more).to_be_focused()
                expect(outline.locator("#toc-nav")).not_to_contain_text("一周时间表")
                expect(rail.get_by_role("link", name="把复习排进一周")).to_have_count(0)
                expect(documents.locator(".doc-title[aria-current=page]")).to_contain_text("从读懂到记住")
                for element in [paper.locator("h1"), paper.locator("h2").first]:
                        expect(element).to_have_css("border-bottom-width", "0px")
                expect(paper.locator("blockquote").first).to_have_css("border-left-width", "0px")
                expect(paper.locator("blockquote").first).to_have_css("background-color", "rgba(0, 0, 0, 0)")
                preview = documents.get_by_role("button", name="预览 把复习排进一周")
                expect(documents.get_by_role("link", name="一周时间表", exact=True)).to_have_count(0)
                preview.click()
                expect(documents.locator(".doc-preview:visible")).to_contain_text("接着用第一页的两个概念做计划")
                expect(documents.get_by_role("link", name="一周时间表", exact=True)).to_be_visible()
                preview.click()
                picker.click()
                query = page.locator("#doc-picker-query")
                expect(query).to_be_focused()
                query.fill("不存在的文档")
                expect(page.locator(".doc-picker-empty")).to_be_visible()
                query.press("Escape")
                expect(picker).to_be_focused()
                picker.click()
                query.fill("03-recall.md")
                expect(page.locator(".doc-picker-list a:visible")).to_have_count(1)
                query.press("ArrowDown")
                expect(page.locator(".doc-picker-list a:visible")).to_be_focused()
                page.keyboard.press("Enter")
                expect(page).to_have_url(re.compile(r"\?p=2$"))
                expect(paper.locator("h1")).to_have_text(re.compile("合上笔记"))
                backlink = documents.locator(".doc-row").filter(has_text="把复习排进一周")
                expect(backlink.locator(".doc-relation")).to_have_text("反链")
                backlink.get_by_role("link", name="把复习排进一周", exact=True).click()
                expect(paper.locator("h1")).to_have_text(re.compile("把复习排进一周"))
                paper.get_by_role("link", name="第一页的概念").click()
                expect(page).to_have_url(re.compile(r"\?p=0#"))
                paragraph = paper.get_by_text(re.compile("^主动回忆回答的是"))
                selection = """el => {
                  const node = el.firstChild;
                  const r = new Range(); r.setStart(node, 0); r.setEnd(node, 7);
                  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
                }"""
                paragraph.evaluate(selection)
                expect(page.locator("#quote-shortcut")).to_be_visible()
                paper.locator("h1").click()
                expect(page.locator("#quote-shortcut")).not_to_be_visible()
                drag_start, drag_end = paragraph.evaluate("""el => [0, 7].map(offset => {
                  const r = new Range(); r.setStart(el.firstChild, offset); r.collapse(true);
                  const rect = r.getBoundingClientRect();
                  return [rect.x, rect.y + rect.height / 2];
                })""")
                page.mouse.move(*drag_start)
                page.mouse.down()
                page.mouse.move(*drag_end, steps=8)
                expect(page.locator("#quote-shortcut")).not_to_be_visible()
                page.mouse.up()
                shortcut = page.locator("#quote-shortcut")
                expect(shortcut).to_be_visible()
                page.evaluate("""() => {
                  document.addEventListener('contextmenu', e => { window.lastMenuPrevented = e.defaultPrevented; });
                }""")
                page.mouse.click(drag_start[0] + 4, drag_start[1], button="right")
                assert page.evaluate("window.lastMenuPrevented") is True
                expect(shortcut).to_be_visible()
                box = shortcut.bounding_box()
                assert abs(box["y"] - drag_start[1]) < 64 and abs(box["x"] - drag_start[0]) < 32
                shortcut.click()
                expect(page.locator("#review-body")).to_be_focused()
                expect(page.locator("#review-anchor-quote")).to_have_text("主动回忆回答的")
                page.locator("#review-body").fill("给我一个反例。")
                page.locator("#review-save").click()
                expect(page.locator(".review-card")).to_contain_text("给我一个反例。")
                assert page.evaluate("CSS.highlights.get('preview-notes').size") == 1
                paper.locator("h1").click(button="right")
                assert page.evaluate("window.lastMenuPrevented") is False
                card = page.locator(".review-card")
                expect(card).not_to_contain_text(re.compile(r"选区|L\d+"))
                expect(card).not_to_contain_text("↗")
                expect(rail).not_to_contain_text("选中文字后")
                card.locator("blockquote").click()
                assert page.evaluate("CSS.highlights.get('preview-active-note').size") == 1
                preview.click()
                documents.get_by_role("link", name="一周时间表", exact=True).click()
                expect(page.locator("#review-list")).to_have_text("本篇还没有批注。")
                expect(page.locator(".review-card")).to_have_count(0)
                table = paper.locator("table")
                assert abs(table.bounding_box()["width"] - paper.locator(".table-wrap").bounding_box()["width"]) < 2
                target = paper.get_by_text(re.compile("^每次只记录两件事"))
                coordinates = target.evaluate("""el => [5, el.firstChild.length].map(offset => {
                  const at = new Range(); at.setStart(el.firstChild, offset); at.collapse(true);
                  const box = at.getBoundingClientRect();
                  return [box.x, box.y + box.height / 2];
                })""")
                page.locator("#review-point").click()
                marker = page.locator(".review-caret")
                page.mouse.click(*coordinates[0])
                expect(marker).to_be_visible()
                expect(marker).to_have_css("width", "1px")
                expect(marker).to_have_css("box-shadow", "none")
                assert abs(marker.bounding_box()["x"] - coordinates[0][0]) < 2
                page.locator("#review-body").fill("检查句中的位置。")
                page.locator("#review-save").click()
                expect(marker).not_to_be_visible()
                page.locator("#review-point").click()
                page.mouse.click(*coordinates[1])
                expect(marker).to_be_visible()
                assert abs(marker.bounding_box()["x"] - coordinates[1][0]) < 2
                page.locator("#review-body").fill("在句末补一张时间轴。")
                page.locator("#review-save").click()
                expect(marker).not_to_be_visible()
                expect(page.locator(".review-card")).to_have_count(2)
                inside_card = page.locator(".review-card").filter(has_text="检查句中的位置。")
                expect(inside_card.locator(".review-caret-context")).to_contain_text("每次只记录|两件事")
                expect(page.locator("#review-list")).not_to_contain_text("给我一个反例。")
                documents.get_by_role("link", name="合上笔记，检验自己", exact=True).click()
                expect(page.locator("#review-list")).to_have_text("本篇还没有批注。")
                page.go_back()
                expect(page.locator(".review-card")).to_have_count(2)
                page.go_back()
                expect(page.locator(".review-card")).to_have_text(re.compile("给我一个反例。"))
                page.go_forward()
                expect(page.locator(".review-card")).to_have_count(2)

                entries = run(*args, "--annotations")["annotations"]
                by_body = {entry["body"]: entry for entry in entries}
                quote = by_body["给我一个反例。"]
                inside = by_body["检查句中的位置。"]
                point = by_body["在句末补一张时间轴。"]
                assert inside["caret"]["offset"] == 5 and inside["caret"]["before"] == "每次只记录"
                assert inside["caret"]["after"].startswith("两件事") and inside["location"] == point["location"]
                assert quote["file"] == "README.md" and quote["quote"] == "主动回忆回答的"
                assert point["file"] == "02-plan.md" and point["location"]["heading"] == "一周时间表"
                doc = notes / point["file"]
                assert "insertAfterLine" not in point["location"]
                line = point["location"]["to"]
                lines = doc.read_text().splitlines()
                assert lines[line - 1].startswith("每次只记录") and lines[line - 1].endswith(point["caret"]["before"])
                assert point["caret"]["after"] == ""
                (notes / "timeline.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="48"><text x="8" y="27">Day 0 → Day 2 → Day 6</text></svg>')
                lines[line:line] = ["", "![一周复习时间轴](timeline.svg)"]
                doc.write_text("\n".join(lines) + "\n")
                run(*args, "--reply", point["id"], "已在时间表后插入一周时间轴。")
                expect(paper.get_by_role("img", name="一周复习时间轴")).to_be_visible()
                expect(page.locator(".review-card").filter(has_text="在句末补一张时间轴。")).to_contain_text("已在时间表后插入一周时间轴。")

                server.terminate()
                server.wait(timeout=5)
                _, url = start()
                page.goto(url + "/?p=1")
                expect(page.locator(".review-reply")).to_contain_text("已在时间表后插入一周时间轴。")
                end_card = page.locator(".review-card").filter(has_text="在句末补一张时间轴。")
                end_card.click(position={"x": 4, "y": 4})
                expect(marker).to_be_visible()
                assert abs(marker.bounding_box()["x"] - coordinates[1][0]) < 2
                page.get_by_role("button", name="定位批注：检查句中的位置。").press("Enter")
                expect(marker).to_have_count(1)
                expect(marker).to_have_css("left", f"{round(coordinates[0][0])}px")

                html = root / "offline.html"
                run(notes, "--out", html)
                page.goto(html.as_uri())
                expect(page.locator("#review-panel")).to_have_count(0)
                paper.get_by_role("link", name="第二页的一周时间表").click()
                expect(page).to_have_url(re.compile(r"#p=1#"))
                expect(outline.locator("#toc-nav").get_by_text("一周时间表")).to_be_visible()
                expect(page.locator("#page-indicator")).to_have_text("2/3")
                pager.get_by_role("link", name="下一篇").click()
                expect(page.locator("#page-indicator")).to_have_text("3/3")
                expect(pager.get_by_role("link", name="下一篇")).to_have_attribute("aria-disabled", "true")
                page.go_back()
                expect(page.locator("#page-indicator")).to_have_text("2/3")
                picker.click()
                expect(page.locator(".doc-picker-list [aria-current=page]")).to_have_text("把复习排进一周")
                page.keyboard.press("Escape")
                page.reload()
                expect(paper.locator("h1")).to_have_text(re.compile("把复习排进一周"))
                page.go_back()
                expect(paper.locator("h1")).to_have_text(re.compile("从读懂到记住"))

                page.set_viewport_size({"width": 390, "height": 810})
                page.goto(url)
                expect(rail).not_to_be_visible()
                page.locator("#toc-toggle-btn").click()
                expect(documents).to_be_visible()
                picker.click()
                expect(outline).not_to_be_visible()
                expect(query).to_be_focused()
                assert query.evaluate("""el => {
                  const r = el.getBoundingClientRect();
                  return document.elementFromPoint(r.x + 12, r.y + r.height / 2) === el;
                }""")
                query.fill("02-plan.md")
                page.locator(".doc-picker-list a:visible").click()
                expect(page.locator("#page-indicator")).to_have_text("2/3")
                table = paper.locator("table")
                wrap = paper.locator(".table-wrap")
                assert abs(table.bounding_box()["width"] - wrap.bounding_box()["width"]) < 2
                page.go_back()
                expect(page.locator("#page-indicator")).to_have_text("1/3")
                page.locator("#rail-toggle").click()
                expect(rail).to_be_visible()
                expect(outline).not_to_be_visible()
                expect(page.locator(".review-card")).to_contain_text("给我一个反例。")
                sheet = rail.bounding_box()
                assert sheet["y"] >= 810 * .56 and abs(sheet["y"] + sheet["height"] - 810) < 2
                assert paper.locator("h1").bounding_box()["y"] < sheet["y"]
                assert not errors, errors
        finally:
                page.close()
                for proc in processes:
                        if proc.poll() is None:
                                proc.terminate()
                        proc.wait(timeout=5)


if __name__ == "__main__":
        with tempfile.TemporaryDirectory() as directory, sync_playwright() as playwright:
                with playwright.chromium.launch() as chromium:
                        check(chromium, Path(directory))
                print("Browser E2E passed: navigation, annotations, Agent edit/reply, restart, export, mobile.")
