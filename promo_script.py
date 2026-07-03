import math
from manim import *

# Define beautiful neon color palette
BG_COLOR = "#0A0A0A"
CYAN = "#00F5FF"
VIOLET = "#FF00FF"
WHITE = "#FFFFFF"
GRAY = "#888888"
DARK_GRAY = "#222222"

class ClydePromo(Scene):
    def construct(self):
        self.camera.background_color = BG_COLOR
        
        # -----------------------------------------------------------------
        # SCENE 1: Introduction (Meet Clyde)
        # -----------------------------------------------------------------
        # Draw clean microphone symbol
        mic_body = RoundedRectangle(corner_radius=0.3, height=1.4, width=0.8, color=CYAN, stroke_width=6)
        mic_stand = Line(start=ORIGIN + DOWN*1.1, end=ORIGIN + DOWN*1.8, color=CYAN, stroke_width=6)
        mic_base = Line(start=ORIGIN + DOWN*1.8 + LEFT*0.5, end=ORIGIN + DOWN*1.8 + RIGHT*0.5, color=CYAN, stroke_width=6)
        mic_u = Arc(radius=0.7, start_angle=PI, angle=PI, color=CYAN, stroke_width=6).shift(DOWN*0.3)
        
        mic = VGroup(mic_body, mic_u, mic_stand, mic_base).move_to(UP*0.5)
        
        # Pulse circles representing audio waves
        ripple1 = Circle(radius=0.1, color=CYAN, stroke_width=2).move_to(mic.get_center())
        ripple2 = Circle(radius=0.1, color=VIOLET, stroke_width=1).move_to(mic.get_center())
        
        intro_text = Text("Meet Clyde.", font="Courier", font_size=40, color=WHITE).next_to(mic, DOWN, buff=0.8)
        
        # Intro Animation Sequence
        self.add_subcaption("Introducing Clyde.", duration=2)
        self.play(Create(mic), run_time=1.5)
        self.play(Write(intro_text), run_time=1.0)
        
        # Ripple effect animation
        self.play(
            ripple1.animate.scale(20).set_opacity(0),
            ripple2.animate.scale(30).set_opacity(0),
            run_time=1.5,
            rate_func=linear
        )
        self.wait(0.5)
        
        # Transition out Scene 1
        self.play(
            FadeOut(mic),
            FadeOut(intro_text),
            FadeOut(ripple1),
            FadeOut(ripple2),
            run_time=0.8
        )
        
        # -----------------------------------------------------------------
        # SCENE 2: Real-time Audio Stream & Transcript
        # -----------------------------------------------------------------
        self.add_subcaption("Your real-time interview co-pilot.", duration=2.5)
        
        # Create an animated sine wave stream representing voice audio
        axes = Axes(x_range=[0, 10, 1], y_range=[-2, 2, 1], x_length=10, y_length=3, axis_config={"include_ticks": False, "stroke_width": 0})
        axes.move_to(UP*0.5)
        
        # Define waveform function
        def wave_func(x, t):
            return 0.8 * math.sin(2 * x - 4 * t) * math.exp(-0.15 * (x - 5)**2)
            
        wave = axes.plot(lambda x: wave_func(x, 0), color=CYAN, stroke_width=4)
        
        # Animate the wave moving
        t_tracker = ValueTracker(0)
        wave.add_updater(lambda m: m.become(
            axes.plot(lambda x: wave_func(x, t_tracker.get_value()), color=CYAN, stroke_width=4)
        ))
        
        self.add(wave)
        self.play(
            t_tracker.animate.set_value(3),
            run_time=2.0,
            rate_func=linear
        )
        
        # Transcript Speech bubbles popping up
        speech_box_interviewer = RoundedRectangle(corner_radius=0.15, height=1.0, width=5.0, color=DARK_GRAY, stroke_width=2).set_fill(DARK_GRAY, opacity=0.7)
        speech_box_interviewer.move_to(UP*1.8 + LEFT*1.5)
        interviewer_text = Text("Interviewer: Tell me about yourself.", font="Courier", font_size=18, color=WHITE).move_to(speech_box_interviewer.get_center())
        interviewer_grp = VGroup(speech_box_interviewer, interviewer_text)
        
        speech_box_you = RoundedRectangle(corner_radius=0.15, height=1.0, width=5.0, color=CYAN, stroke_width=2).set_fill(CYAN, opacity=0.15)
        speech_box_you.move_to(DOWN*1.2 + RIGHT*1.5)
        you_text = Text("You: I specialize in scaling support...", font="Courier", font_size=18, color=CYAN).move_to(speech_box_you.get_center())
        you_grp = VGroup(speech_box_you, you_text)
        
        # Reveal speech boxes
        self.play(FadeIn(interviewer_grp, shift=UP*0.3), run_time=0.8)
        self.play(
            t_tracker.animate.set_value(6),
            FadeIn(you_grp, shift=DOWN*0.3),
            run_time=2.0,
            rate_func=linear
        )
        
        # Clean up Scene 2
        wave.remove_updater(wave)
        self.play(
            FadeOut(wave),
            FadeOut(interviewer_grp),
            FadeOut(you_grp),
            run_time=0.8
        )
        
        # -----------------------------------------------------------------
        # SCENE 3: Instant AI Assistant Cards
        # -----------------------------------------------------------------
        self.add_subcaption("Get instant, context-aware AI suggestions.", duration=3)
        
        # Draw a beautiful glassmorphic Clyde Answer Card
        card_bg = RoundedRectangle(corner_radius=0.3, height=4.2, width=8.5, color=DARK_GRAY, stroke_width=3).set_fill("#11151d", opacity=0.85)
        card_bg.move_to(ORIGIN)
        
        card_header = Text("Clyde Suggestion: Walk through CRM Audit", font="Courier", font_size=20, color=VIOLET).move_to(card_bg.get_top() + DOWN*0.5)
        divider = Line(start=card_bg.get_left() + RIGHT*0.5 + UP*1.2, end=card_bg.get_right() + LEFT*0.5 + UP*1.2, color=GRAY, stroke_width=1)
        
        bullet1 = Text("• Focus on the 40% reduction in agent handling time", font="Courier", font_size=16, color=WHITE).move_to(UP*0.5 + LEFT*0.5)
        bullet2 = Text("• Highlight automated API routing you configured", font="Courier", font_size=16, color=WHITE).next_to(bullet1, DOWN, buff=0.4, aligned_edge=LEFT)
        bullet3 = Text("• Emphasize scaling operations under pressure", font="Courier", font_size=16, color=WHITE).next_to(bullet2, DOWN, buff=0.4, aligned_edge=LEFT)
        
        bullets = VGroup(bullet1, bullet2, bullet3)
        card_group = VGroup(card_bg, card_header, divider, bullets)
        
        # Card Entrance
        self.play(GrowFromCenter(card_group), run_time=1.5)
        self.wait(1.5)
        
        # Fade out card
        self.play(FadeOut(card_group), run_time=0.8)
        
        # -----------------------------------------------------------------
        # SCENE 4: CTA (Call to Action)
        # -----------------------------------------------------------------
        self.add_subcaption("Level up your live conversations today.", duration=3)
        
        # Animated clean ghost shape representing Clyde logo
        ghost_body = RoundedRectangle(corner_radius=0.8, height=1.8, width=1.8, color=WHITE, stroke_width=0).set_fill(WHITE, opacity=1.0)
        ghost_skirt1 = Triangle(color=BG_COLOR, fill_opacity=1.0).scale(0.3).move_to(ghost_body.get_bottom() + LEFT*0.5)
        ghost_skirt2 = Triangle(color=BG_COLOR, fill_opacity=1.0).scale(0.3).move_to(ghost_body.get_bottom() + RIGHT*0.5)
        
        eye1 = Circle(radius=0.15, color=BG_COLOR, fill_opacity=1.0).move_to(ghost_body.get_center() + UP*0.2 + LEFT*0.35)
        eye2 = Circle(radius=0.15, color=BG_COLOR, fill_opacity=1.0).move_to(ghost_body.get_center() + UP*0.2 + RIGHT*0.35)
        
        ghost = VGroup(ghost_body, ghost_skirt1, ghost_skirt2, eye1, eye2).scale(1.2).move_to(UP*1.0)
        
        # Brand Typography
        brand_title = Text("CLYDE", font="Courier", font_size=52, color=CYAN, weight=BOLD).next_to(ghost, DOWN, buff=0.6)
        brand_sub = Text("Level Up Your Live Conversations.", font="Courier", font_size=20, color=WHITE).next_to(brand_title, DOWN, buff=0.4)
        brand_url = Text("clyde.ai", font="Courier", font_size=24, color=VIOLET).next_to(brand_sub, DOWN, buff=0.4)
        
        # Final Draw Sequence
        self.play(DrawBorderThenFill(ghost), run_time=1.5)
        self.play(Write(brand_title), run_time=0.8)
        self.play(Write(brand_sub), run_time=0.8)
        self.play(Write(brand_url), run_time=0.8)
        
        self.wait(2.5)
        
        # Smooth Fade out all elements
        self.play(FadeOut(Group(*self.mobjects)), run_time=1.0)
        self.wait(0.5)
