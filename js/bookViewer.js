    const up = (e) => {
      S.pointers.delete(e.pointerId);
      if (!S.pointers.size && !zoomed() && moved) {
        const dx = e.clientX - downX;
        if (dx < -50) next(); // swipe left → next (flip disabled while zoomed)
        else if (dx > 50) prev(); // swipe right → prev
      }
    };